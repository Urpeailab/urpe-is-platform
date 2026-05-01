"""
Iteration 39 - Prompt Improvements Tests
Tests for: Expert and Recommendation Letter prompts with Dhanasar 3-prong structure,
federal gap, BLS citations, temperature 0.35, max_tokens=8000,
_heavy_generation_semaphore, non-blocking startup migration.
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestHealthAndBasicEndpoints:
    """Health check and basic API availability"""

    def test_health_endpoint(self):
        """GET /health should return 200"""
        response = requests.get(f"{BASE_URL}/health", timeout=15)
        assert response.status_code == 200, f"Health check failed: {response.status_code} - {response.text}"
        print(f"✅ /health returned {response.status_code}")

    def test_expert_letters_list_endpoint(self):
        """GET /api/expert-letters should return 200, 401, or 403 (auth required)"""
        response = requests.get(f"{BASE_URL}/api/expert-letters", timeout=15)
        assert response.status_code in [200, 401, 403], \
            f"Unexpected status: {response.status_code} - {response.text}"
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, (list, dict)), "Expected list or dict response"
            print(f"✅ /api/expert-letters returned {response.status_code}")
        else:
            print(f"⚠️ /api/expert-letters returned {response.status_code} (auth required - expected)")

    def test_recommendation_letters_list_endpoint(self):
        """GET /api/recommendation-letters should return 200, 401, or 403 (auth required)"""
        response = requests.get(f"{BASE_URL}/api/recommendation-letters", timeout=15)
        assert response.status_code in [200, 401, 403], \
            f"Unexpected status: {response.status_code} - {response.text}"
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, (list, dict)), "Expected list or dict response"
            print(f"✅ /api/recommendation-letters returned {response.status_code}")
        else:
            print(f"⚠️ /api/recommendation-letters returned {response.status_code} (auth required - expected)")


class TestExpertLetterSystemPrompt:
    """Verify expert_letter_endpoints.py EXPERT_LETTER_SYSTEM_PROMPT content"""

    def test_expert_prompt_has_dhanasar(self):
        """EXPERT_LETTER_SYSTEM_PROMPT must contain 'Dhanasar'"""
        from expert_letter_endpoints import EXPERT_LETTER_SYSTEM_PROMPT
        assert 'Dhanasar' in EXPERT_LETTER_SYSTEM_PROMPT, \
            "EXPERT_LETTER_SYSTEM_PROMPT missing 'Dhanasar'"
        print("✅ EXPERT_LETTER_SYSTEM_PROMPT contains 'Dhanasar'")

    def test_expert_prompt_has_prong1(self):
        """EXPERT_LETTER_SYSTEM_PROMPT must contain 'PRONG 1'"""
        from expert_letter_endpoints import EXPERT_LETTER_SYSTEM_PROMPT
        assert 'PRONG 1' in EXPERT_LETTER_SYSTEM_PROMPT, \
            "EXPERT_LETTER_SYSTEM_PROMPT missing 'PRONG 1'"
        print("✅ EXPERT_LETTER_SYSTEM_PROMPT contains 'PRONG 1'")

    def test_expert_prompt_has_prong2(self):
        """EXPERT_LETTER_SYSTEM_PROMPT must contain 'PRONG 2'"""
        from expert_letter_endpoints import EXPERT_LETTER_SYSTEM_PROMPT
        assert 'PRONG 2' in EXPERT_LETTER_SYSTEM_PROMPT, \
            "EXPERT_LETTER_SYSTEM_PROMPT missing 'PRONG 2'"
        print("✅ EXPERT_LETTER_SYSTEM_PROMPT contains 'PRONG 2'")

    def test_expert_prompt_has_prong3(self):
        """EXPERT_LETTER_SYSTEM_PROMPT must contain 'PRONG 3'"""
        from expert_letter_endpoints import EXPERT_LETTER_SYSTEM_PROMPT
        assert 'PRONG 3' in EXPERT_LETTER_SYSTEM_PROMPT, \
            "EXPERT_LETTER_SYSTEM_PROMPT missing 'PRONG 3'"
        print("✅ EXPERT_LETTER_SYSTEM_PROMPT contains 'PRONG 3'")

    def test_expert_prompt_has_bls(self):
        """EXPERT_LETTER_SYSTEM_PROMPT must contain 'BLS'"""
        from expert_letter_endpoints import EXPERT_LETTER_SYSTEM_PROMPT
        assert 'BLS' in EXPERT_LETTER_SYSTEM_PROMPT, \
            "EXPERT_LETTER_SYSTEM_PROMPT missing 'BLS'"
        print("✅ EXPERT_LETTER_SYSTEM_PROMPT contains 'BLS'")

    def test_expert_prompt_has_federal_gap(self):
        """EXPERT_LETTER_SYSTEM_PROMPT must contain 'federal gap'"""
        from expert_letter_endpoints import EXPERT_LETTER_SYSTEM_PROMPT
        assert 'federal gap' in EXPERT_LETTER_SYSTEM_PROMPT.lower(), \
            "EXPERT_LETTER_SYSTEM_PROMPT missing 'federal gap'"
        print("✅ EXPERT_LETTER_SYSTEM_PROMPT contains 'federal gap'")

    def test_expert_anti_placeholder_rule_exists(self):
        """ANTI_PLACEHOLDER_RULE must exist and be non-empty"""
        from expert_letter_endpoints import ANTI_PLACEHOLDER_RULE
        assert ANTI_PLACEHOLDER_RULE, "ANTI_PLACEHOLDER_RULE is empty or missing"
        assert 'NO PLACEHOLDERS' in ANTI_PLACEHOLDER_RULE.upper() or \
               'PLACEHOLDER' in ANTI_PLACEHOLDER_RULE.upper(), \
            "ANTI_PLACEHOLDER_RULE does not mention placeholders"
        print("✅ ANTI_PLACEHOLDER_RULE exists and mentions placeholders")

    def test_expert_prompt_matter_of_dhanasar_citation(self):
        """EXPERT_LETTER_SYSTEM_PROMPT must cite 'Matter of Dhanasar, 26 I&N Dec. 884'"""
        from expert_letter_endpoints import EXPERT_LETTER_SYSTEM_PROMPT
        assert 'Matter of Dhanasar, 26 I&N Dec. 884' in EXPERT_LETTER_SYSTEM_PROMPT, \
            "EXPERT_LETTER_SYSTEM_PROMPT missing full Dhanasar citation"
        print("✅ EXPERT_LETTER_SYSTEM_PROMPT contains full Dhanasar citation")


class TestRecommendationLetterSystemPrompt:
    """Verify recommendation_letter_endpoints.py RECOMMENDATION_LETTER_SYSTEM_PROMPT content"""

    def test_recommendation_prompt_has_dhanasar(self):
        """RECOMMENDATION_LETTER_SYSTEM_PROMPT must contain 'Dhanasar'"""
        from recommendation_letter_endpoints import RECOMMENDATION_LETTER_SYSTEM_PROMPT
        assert 'Dhanasar' in RECOMMENDATION_LETTER_SYSTEM_PROMPT, \
            "RECOMMENDATION_LETTER_SYSTEM_PROMPT missing 'Dhanasar'"
        print("✅ RECOMMENDATION_LETTER_SYSTEM_PROMPT contains 'Dhanasar'")

    def test_recommendation_prompt_has_prong1(self):
        """RECOMMENDATION_LETTER_SYSTEM_PROMPT must contain 'PRONG 1'"""
        from recommendation_letter_endpoints import RECOMMENDATION_LETTER_SYSTEM_PROMPT
        assert 'PRONG 1' in RECOMMENDATION_LETTER_SYSTEM_PROMPT, \
            "RECOMMENDATION_LETTER_SYSTEM_PROMPT missing 'PRONG 1'"
        print("✅ RECOMMENDATION_LETTER_SYSTEM_PROMPT contains 'PRONG 1'")

    def test_recommendation_prompt_has_prong2(self):
        """RECOMMENDATION_LETTER_SYSTEM_PROMPT must contain 'PRONG 2'"""
        from recommendation_letter_endpoints import RECOMMENDATION_LETTER_SYSTEM_PROMPT
        assert 'PRONG 2' in RECOMMENDATION_LETTER_SYSTEM_PROMPT, \
            "RECOMMENDATION_LETTER_SYSTEM_PROMPT missing 'PRONG 2'"
        print("✅ RECOMMENDATION_LETTER_SYSTEM_PROMPT contains 'PRONG 2'")

    def test_recommendation_prompt_has_prong3(self):
        """RECOMMENDATION_LETTER_SYSTEM_PROMPT must contain 'PRONG 3'"""
        from recommendation_letter_endpoints import RECOMMENDATION_LETTER_SYSTEM_PROMPT
        assert 'PRONG 3' in RECOMMENDATION_LETTER_SYSTEM_PROMPT, \
            "RECOMMENDATION_LETTER_SYSTEM_PROMPT missing 'PRONG 3'"
        print("✅ RECOMMENDATION_LETTER_SYSTEM_PROMPT contains 'PRONG 3'")

    def test_recommendation_prompt_has_bls(self):
        """RECOMMENDATION_LETTER_SYSTEM_PROMPT must contain 'BLS'"""
        from recommendation_letter_endpoints import RECOMMENDATION_LETTER_SYSTEM_PROMPT
        assert 'BLS' in RECOMMENDATION_LETTER_SYSTEM_PROMPT, \
            "RECOMMENDATION_LETTER_SYSTEM_PROMPT missing 'BLS'"
        print("✅ RECOMMENDATION_LETTER_SYSTEM_PROMPT contains 'BLS'")

    def test_recommendation_prompt_has_federal_gap(self):
        """RECOMMENDATION_LETTER_SYSTEM_PROMPT must contain 'FEDERAL GAP' or 'federal gap'"""
        from recommendation_letter_endpoints import RECOMMENDATION_LETTER_SYSTEM_PROMPT
        assert 'FEDERAL GAP' in RECOMMENDATION_LETTER_SYSTEM_PROMPT or \
               'federal gap' in RECOMMENDATION_LETTER_SYSTEM_PROMPT.lower(), \
            "RECOMMENDATION_LETTER_SYSTEM_PROMPT missing 'FEDERAL GAP'"
        print("✅ RECOMMENDATION_LETTER_SYSTEM_PROMPT contains 'FEDERAL GAP'")

    def test_recommendation_anti_placeholder_rule_exists(self):
        """RECOMMENDATION_ANTI_PLACEHOLDER_RULE must exist and be non-empty"""
        from recommendation_letter_endpoints import RECOMMENDATION_ANTI_PLACEHOLDER_RULE
        assert RECOMMENDATION_ANTI_PLACEHOLDER_RULE, \
            "RECOMMENDATION_ANTI_PLACEHOLDER_RULE is empty or missing"
        assert 'PLACEHOLDER' in RECOMMENDATION_ANTI_PLACEHOLDER_RULE.upper(), \
            "RECOMMENDATION_ANTI_PLACEHOLDER_RULE does not mention placeholders"
        print("✅ RECOMMENDATION_ANTI_PLACEHOLDER_RULE exists")

    def test_recommendation_prompt_matter_of_dhanasar_citation(self):
        """RECOMMENDATION_LETTER_SYSTEM_PROMPT must cite 'Matter of Dhanasar, 26 I&N Dec. 884'"""
        from recommendation_letter_endpoints import RECOMMENDATION_LETTER_SYSTEM_PROMPT
        assert 'Matter of Dhanasar, 26 I&N Dec. 884' in RECOMMENDATION_LETTER_SYSTEM_PROMPT, \
            "RECOMMENDATION_LETTER_SYSTEM_PROMPT missing full Dhanasar citation"
        print("✅ RECOMMENDATION_LETTER_SYSTEM_PROMPT contains full Dhanasar citation")


class TestExpertLettersRouterGenerationPrompt:
    """Verify expert_letters_router.py generation_prompt and LLM parameters"""

    def test_router_file_has_prong1_in_prompt(self):
        """expert_letters_router.py generation_prompt must contain 'PRONG 1'"""
        with open('/app/backend/routers/expert_letters_router.py', 'r') as f:
            content = f.read()
        assert 'PRONG 1' in content, \
            "expert_letters_router.py missing 'PRONG 1' in generation_prompt"
        print("✅ expert_letters_router.py contains 'PRONG 1'")

    def test_router_file_has_prong2_in_prompt(self):
        """expert_letters_router.py generation_prompt must contain 'PRONG 2'"""
        with open('/app/backend/routers/expert_letters_router.py', 'r') as f:
            content = f.read()
        assert 'PRONG 2' in content, \
            "expert_letters_router.py missing 'PRONG 2'"
        print("✅ expert_letters_router.py contains 'PRONG 2'")

    def test_router_file_has_prong3_in_prompt(self):
        """expert_letters_router.py generation_prompt must contain 'PRONG 3'"""
        with open('/app/backend/routers/expert_letters_router.py', 'r') as f:
            content = f.read()
        assert 'PRONG 3' in content, \
            "expert_letters_router.py missing 'PRONG 3'"
        print("✅ expert_letters_router.py contains 'PRONG 3'")

    def test_router_file_has_dhanasar(self):
        """expert_letters_router.py must reference 'Dhanasar'"""
        with open('/app/backend/routers/expert_letters_router.py', 'r') as f:
            content = f.read()
        assert 'Dhanasar' in content, \
            "expert_letters_router.py missing 'Dhanasar'"
        print("✅ expert_letters_router.py contains 'Dhanasar'")

    def test_router_file_has_federal_gap(self):
        """expert_letters_router.py must contain 'federal gap'"""
        with open('/app/backend/routers/expert_letters_router.py', 'r') as f:
            content = f.read()
        assert 'federal gap' in content.lower() or 'FEDERAL GAP' in content, \
            "expert_letters_router.py missing 'federal gap'"
        print("✅ expert_letters_router.py contains 'federal gap'")

    def test_router_file_temperature_035(self):
        """expert_letters_router.py must use temperature=0.35"""
        with open('/app/backend/routers/expert_letters_router.py', 'r') as f:
            content = f.read()
        assert 'temperature=0.35' in content, \
            "expert_letters_router.py missing temperature=0.35"
        print("✅ expert_letters_router.py uses temperature=0.35")

    def test_router_file_max_tokens_8000(self):
        """expert_letters_router.py must use max_tokens=8000"""
        with open('/app/backend/routers/expert_letters_router.py', 'r') as f:
            content = f.read()
        assert 'max_tokens=8000' in content, \
            "expert_letters_router.py missing max_tokens=8000"
        print("✅ expert_letters_router.py uses max_tokens=8000")


class TestServerPyRecommendationLetterPrompt:
    """Verify server.py recommendation letter generation_prompt and LLM parameters"""

    def test_server_recommendation_has_prong1(self):
        """server.py recommendation generation_prompt must contain 'PRONG 1'"""
        # Check the relevant section of server.py
        with open('/app/backend/server.py', 'r') as f:
            content = f.read()
        # Find the recommendation letter section
        assert 'PRONG 1' in content or 'Prong 1' in content, \
            "server.py missing 'PRONG 1' in recommendation letter section"
        print("✅ server.py contains 'PRONG 1'")

    def test_server_recommendation_has_dhanasar(self):
        """server.py must contain 'Dhanasar' reference"""
        with open('/app/backend/server.py', 'r') as f:
            content = f.read()
        assert 'Dhanasar' in content, \
            "server.py missing 'Dhanasar'"
        print("✅ server.py contains 'Dhanasar'")

    def test_server_recommendation_temperature_035(self):
        """server.py recommendation letter must use temperature=0.35"""
        with open('/app/backend/server.py', 'r') as f:
            content = f.read()
        assert 'temperature=0.35' in content, \
            "server.py missing temperature=0.35 for recommendation letter"
        print("✅ server.py uses temperature=0.35")

    def test_server_recommendation_max_tokens_8000(self):
        """server.py recommendation letter must use max_tokens=8000"""
        with open('/app/backend/server.py', 'r') as f:
            content = f.read()
        # Verify the line near recommendation letter generation
        import re
        matches = re.findall(r'max_tokens=8000', content)
        assert len(matches) >= 1, "server.py missing max_tokens=8000 for recommendation letter"
        print(f"✅ server.py uses max_tokens=8000 ({len(matches)} occurrences)")


class TestProductionSafeguards:
    """Verify production uptime safeguards"""

    def test_server_py_has_heavy_semaphore(self):
        """server.py must have _heavy_generation_semaphore = asyncio.Semaphore(3)"""
        with open('/app/backend/server.py', 'r') as f:
            content = f.read()
        assert '_heavy_generation_semaphore = asyncio.Semaphore(3)' in content, \
            "server.py missing _heavy_generation_semaphore = asyncio.Semaphore(3)"
        print("✅ server.py has _heavy_generation_semaphore = asyncio.Semaphore(3)")

    def test_server_py_startup_migration_non_blocking(self):
        """server.py startup migration must use asyncio.ensure_future (non-blocking)"""
        with open('/app/backend/server.py', 'r') as f:
            content = f.read()
        assert 'ensure_future' in content, \
            "server.py missing ensure_future for non-blocking startup migration"
        print("✅ server.py uses asyncio.ensure_future for non-blocking migration")

    def test_server_py_migration_in_async_wrapper(self):
        """server.py migration must be wrapped in async function"""
        with open('/app/backend/server.py', 'r') as f:
            content = f.read()
        assert '_run_migrations' in content, \
            "server.py missing _run_migrations async wrapper"
        print("✅ server.py has _run_migrations async wrapper")
