import pytest
import os
import math
from unittest.mock import patch, MagicMock
from httpx import HTTPError, Response
from pydantic import ValidationError
from app.schemas.ai_analyst_schema import AIAnalystInput, AIAnalystResponse
from app.services.ai_analyst_service import analyze_security_event
from app.config.runtime import get_runtime_config


@pytest.fixture
def mock_input():
    return AIAnalystInput(
        event={"event_type": "SQL_INJECTION", "src_ip": "192.168.1.100"},
        detection={"detections": [{"confidence": 0.8}]},
        risk={"threat_level": "HIGH", "risk_score": 80},
        context={}
    )


@patch("app.services.ai_analyst_service.httpx.Client.post")
@patch("app.services.ai_analyst_service.get_runtime_config")
def test_adapter_disabled(mock_get_config, mock_post, mock_input):
    """Test deterministic fallback and zero HTTP requests when AI analyst is disabled."""
    mock_get_config.return_value = MagicMock(ai_analyst_enabled=False)
    
    response = analyze_security_event(mock_input)
    assert response.engine == "deterministic_rules_v1"
    assert response.decision == "INVESTIGATE"
    assert response.confidence == 0.8
    mock_post.assert_not_called()


@patch("app.services.ai_analyst_service.httpx.Client.post")
@patch("app.services.ai_analyst_service.get_runtime_config")
def test_adapter_enabled_malicious(mock_get_config, mock_post, mock_input):
    """Test successful API call to GT-Beta for a malicious event."""
    mock_get_config.return_value = MagicMock(
        ai_analyst_enabled=True,
        ai_analyst_url="http://mock:8000/v1/analyze",
        ai_analyst_timeout=5
    )
    
    mock_response = MagicMock(spec=Response)
    mock_response.json.return_value = {
        "decision": "RESPOND",
        "action_type": "BLOCK_IP",
        "target": "192.168.1.100",
        "confidence": 0.95,
        "threat_level": "CRITICAL",
        "reason": "Model says so",
        "recommended_actions": ["Block it"],
        "attack_type": "SQLi",
        "evidence": ["' OR 1=1"]
    }
    mock_post.return_value = mock_response
    
    response = analyze_security_event(mock_input)
    
    assert response.engine == "gt-beta-http"
    assert response.decision == "RESPOND"
    assert response.action_type == "BLOCK_IP"
    assert response.target == "192.168.1.100"
    assert response.confidence == 0.95
    assert response.threat_level == "CRITICAL"
    assert response.reason == "Model says so"
    assert response.attack_type == "SQLi"
    assert response.evidence == ["' OR 1=1"]
    
    # SAFETY constraints MUST be preserved
    assert response.requires_approval is True
    assert response.source_ip_trusted is False
    
    # Verify the payload structure sent to the server
    mock_post.assert_called_once()
    payload = mock_post.call_args[1]["json"]
    assert "event" in payload
    assert "event" in payload["event"]
    assert payload["event"]["event"]["event_type"] == "SQL_INJECTION"


@patch("app.services.ai_analyst_service.httpx.Client.post")
@patch("app.services.ai_analyst_service.get_runtime_config")
def test_adapter_enabled_benign(mock_get_config, mock_post, mock_input):
    """Test valid benign response."""
    mock_get_config.return_value = MagicMock(ai_analyst_enabled=True, ai_analyst_timeout=5)
    
    mock_response = MagicMock(spec=Response)
    mock_response.json.return_value = {
        "decision": "MONITOR",
        "confidence": 0.99,
        "threat_level": "LOW",
        "reason": "Normal traffic",
    }
    mock_post.return_value = mock_response
    
    response = analyze_security_event(mock_input)
    assert response.engine == "gt-beta-http"
    assert response.decision == "MONITOR"
    assert response.threat_level == "LOW"


@patch("app.services.ai_analyst_service.httpx.Client.post")
@patch("app.services.ai_analyst_service.get_runtime_config")
def test_adapter_missing_fields_and_invalid_enums(mock_get_config, mock_post, mock_input):
    """Test response with missing fields or invalid enums fallback correctly if Pydantic rejects them."""
    mock_get_config.return_value = MagicMock(ai_analyst_enabled=True, ai_analyst_timeout=5)
    
    mock_response = MagicMock(spec=Response)
    mock_response.json.return_value = {
        "decision": "NOT_A_VALID_ENUM",
        "threat_level": "SUPER_HIGH",
    }
    mock_post.return_value = mock_response
    
    # Pydantic validation will fail, triggering fallback
    response = analyze_security_event(mock_input)
    assert response.engine == "deterministic_rules_v1"


@patch("app.services.ai_analyst_service.httpx.Client.post")
@patch("app.services.ai_analyst_service.get_runtime_config")
def test_adapter_invalid_confidence(mock_get_config, mock_post, mock_input):
    """Test response with NaN or out-of-bounds confidence."""
    mock_get_config.return_value = MagicMock(ai_analyst_enabled=True, ai_analyst_timeout=5)
    
    mock_response = MagicMock(spec=Response)
    mock_response.json.return_value = {
        "decision": "MONITOR",
        "threat_level": "LOW",
        "confidence": float('nan'),
        "reason": "x",
    }
    mock_post.return_value = mock_response
    
    # Pydantic validation failure -> fallback
    response = analyze_security_event(mock_input)
    assert response.engine == "deterministic_rules_v1"
    
    mock_response.json.return_value["confidence"] = 1.5
    response2 = analyze_security_event(mock_input)
    assert response2.engine == "deterministic_rules_v1"


@patch("app.services.ai_analyst_service.httpx.Client.post")
@patch("app.services.ai_analyst_service.get_runtime_config")
def test_adapter_timeout_connection_http_malformed(mock_get_config, mock_post, mock_input):
    """Test HTTP 500, timeout, connection refusal, and malformed JSON fallback."""
    mock_get_config.return_value = MagicMock(ai_analyst_enabled=True, ai_analyst_timeout=5)
    
    # HTTP 500
    mock_response = MagicMock(spec=Response)
    mock_response.raise_for_status.side_effect = HTTPError("500 Server Error")
    mock_post.return_value = mock_response
    assert analyze_security_event(mock_input).engine == "deterministic_rules_v1"
    
    # Timeout / Connection error
    mock_post.side_effect = HTTPError("Timeout or Connection Refused")
    assert analyze_security_event(mock_input).engine == "deterministic_rules_v1"
    
    # Malformed JSON
    mock_post.side_effect = None
    mock_response.raise_for_status.side_effect = None
    mock_response.json.side_effect = ValueError("JSON Decode Error")
    assert analyze_security_event(mock_input).engine == "deterministic_rules_v1"
