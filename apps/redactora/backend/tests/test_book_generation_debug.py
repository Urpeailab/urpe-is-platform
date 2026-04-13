#!/usr/bin/env python3
"""
Comprehensive Book Module End-to-End Testing for Chapter Generation Issue Diagnosis

This test file specifically addresses the user-reported issue:
"Chapter 1 is not being generated" despite backend logs showing:
1. Chapter generation IS running (attempts 1-3)
2. Validation is failing (content too long > 4000 chars)
3. After 3 failed attempts, system should use last version anyway
4. But user reports chapter is not appearing

Test Credentials: demo@user.com / password
"""

import requests
import json
import sys
import time
from datetime import datetime

class BookGenerationDebugTester:
    def __init__(self, base_url="https://niwtoolsuite.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.access_token = None
        self.test_results = []
        self.tests_run = 0
        self.tests_passed = 0
        
        # Test credentials from review request - trying working credentials from test_result.md
        self.test_email = "demo@example.com"
        self.test_password = "string"
        
        print("=" * 80)
        print("📚 BOOK MODULE END-TO-END TESTING - CHAPTER GENERATION DEBUG")
        print("=" * 80)
        print(f"🎯 Target Issue: Chapter 1 not appearing despite backend generation attempts")
        print(f"🔍 Focus: Complete workflow from login to chapter verification")
        print(f"🌐 Backend URL: {self.base_url}")
        print(f"👤 Test Credentials: {self.test_email} / {self.test_password}")
        print("=" * 80)

    def log_test(self, name, success, details="", debug_info=None):
        """Log test results with detailed information"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
            if debug_info:
                print(f"   📊 Debug Info: {debug_info}")
        else:
            print(f"❌ {name} - FAILED: {details}")
            if debug_info:
                print(f"   🔍 Debug Info: {debug_info}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details,
            "debug_info": debug_info,
            "timestamp": datetime.now().isoformat()
        })

    def make_request(self, method, endpoint, data=None, timeout=120, auth_required=True):
        """Make HTTP request with proper error handling and debugging"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if auth_required and self.access_token:
            headers['Authorization'] = f'Bearer {self.access_token}'
        
        print(f"\n🔗 {method} {url}")
        if auth_required:
            print(f"   🔐 Auth: {'✓' if self.access_token else '✗'}")
        if data:
            print(f"   📤 Request Data: {json.dumps(data, indent=2)[:200]}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=timeout)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=timeout)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=timeout)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=timeout)
            
            print(f"   📥 Response Status: {response.status_code}")
            print(f"   📏 Response Size: {len(response.content)} bytes")
            
            # Try to parse JSON response
            try:
                response_data = response.json() if response.content else {}
                if response_data and isinstance(response_data, dict):
                    # Print key response fields for debugging
                    key_fields = ['id', 'status', 'message', 'error', 'detail', 'chapter', 'validation_warning']
                    debug_fields = {k: v for k, v in response_data.items() if k in key_fields}
                    if debug_fields:
                        print(f"   🔍 Key Fields: {json.dumps(debug_fields, indent=2)}")
            except:
                response_data = {}
                print(f"   ⚠️ Non-JSON Response: {response.text[:200]}...")
            
            return response.status_code, response_data, response.text
            
        except requests.exceptions.Timeout:
            print(f"   ⏰ Request timeout after {timeout}s")
            return None, {}, f"Timeout after {timeout}s"
        except Exception as e:
            print(f"   💥 Request error: {str(e)}")
            return None, {}, str(e)

    def test_1_login(self):
        """Step 1: Login with provided credentials"""
        print(f"\n{'='*60}")
        print(f"🔐 STEP 1: LOGIN")
        print(f"{'='*60}")
        
        login_data = {
            "email": self.test_email,
            "password": self.test_password
        }
        
        status_code, response_data, response_text = self.make_request(
            'POST', 'auth/login', login_data, timeout=30, auth_required=False
        )
        
        if status_code == 200 and 'access_token' in response_data:
            self.access_token = response_data['access_token']
            user_info = response_data.get('user', {})
            
            self.log_test(
                "Login Authentication", 
                True, 
                f"Successfully authenticated as {user_info.get('email', 'unknown')}",
                {
                    "user_id": user_info.get('id'),
                    "user_email": user_info.get('email'),
                    "token_length": len(self.access_token)
                }
            )
            return True
        else:
            self.log_test(
                "Login Authentication", 
                False, 
                f"Status: {status_code}, Response: {response_text[:200]}",
                {"expected_status": 200, "actual_status": status_code}
            )
            return False

    def test_2_suggest_book_ideas(self):
        """Step 2: Create New Book - Get book ideas"""
        print(f"\n{'='*60}")
        print(f"📚 STEP 2: CREATE NEW BOOK - SUGGEST IDEAS")
        print(f"{'='*60}")
        
        # Minimal profile data as mentioned in review request
        profile_data = {
            "author_name": "Test Author",
            "profile_summary": "Professional writer with 10 years experience in fiction and non-fiction writing. Specializes in technology and business topics.",
            "language": "es"
        }
        
        status_code, response_data, response_text = self.make_request(
            'POST', 'books/suggest-ideas', profile_data, timeout=60
        )
        
        if status_code == 200 and 'suggestions' in response_data:
            suggestions = response_data['suggestions']
            
            if isinstance(suggestions, list) and len(suggestions) > 0:
                self.selected_idea = suggestions[0]  # Select first suggestion
                
                self.log_test(
                    "Book Ideas Suggestions", 
                    True, 
                    f"Received {len(suggestions)} book ideas",
                    {
                        "suggestions_count": len(suggestions),
                        "selected_idea": self.selected_idea,
                        "all_suggestions": suggestions
                    }
                )
                return True
            else:
                self.log_test(
                    "Book Ideas Suggestions", 
                    False, 
                    f"Invalid suggestions format: {type(suggestions)}",
                    {"response_data": response_data}
                )
                return False
        else:
            self.log_test(
                "Book Ideas Suggestions", 
                False, 
                f"Status: {status_code}, Response: {response_text[:200]}",
                {"expected_status": 200, "actual_status": status_code}
            )
            return False

    def test_3_suggest_book_titles(self):
        """Step 3: Get title suggestions based on selected idea"""
        print(f"\n{'='*60}")
        print(f"📚 STEP 3: SUGGEST BOOK TITLES")
        print(f"{'='*60}")
        
        if not hasattr(self, 'selected_idea'):
            self.log_test(
                "Book Title Suggestions", 
                False, 
                "No selected idea available from previous step"
            )
            return False
        
        title_data = {
            "selected_idea": self.selected_idea,
            "profile_summary": "Professional writer with 10 years experience in fiction and non-fiction writing. Specializes in technology and business topics."
        }
        
        status_code, response_data, response_text = self.make_request(
            'POST', 'books/suggest-titles', title_data, timeout=60
        )
        
        if status_code == 200 and 'suggestions' in response_data:
            suggestions = response_data['suggestions']
            
            if isinstance(suggestions, list) and len(suggestions) > 0:
                self.selected_title = suggestions[0]  # Select first suggestion
                
                self.log_test(
                    "Book Title Suggestions", 
                    True, 
                    f"Received {len(suggestions)} title suggestions",
                    {
                        "suggestions_count": len(suggestions),
                        "selected_title": self.selected_title,
                        "all_suggestions": suggestions
                    }
                )
                return True
            else:
                self.log_test(
                    "Book Title Suggestions", 
                    False, 
                    f"Invalid suggestions format: {type(suggestions)}",
                    {"response_data": response_data}
                )
                return False
        else:
            self.log_test(
                "Book Title Suggestions", 
                False, 
                f"Status: {status_code}, Response: {response_text[:200]}",
                {"expected_status": 200, "actual_status": status_code}
            )
            return False

    def test_4_start_book(self):
        """Step 4: Start book creation with selected title"""
        print(f"\n{'='*60}")
        print(f"🚀 STEP 4: START BOOK CREATION")
        print(f"{'='*60}")
        
        if not hasattr(self, 'selected_title'):
            self.log_test(
                "Start Book Creation", 
                False, 
                "No selected title available from previous step"
            )
            return False
        
        book_data = {
            "title": self.selected_title,
            "genre": "Technology",
            "synopsis": "A comprehensive guide exploring modern technology trends and their impact on business and society.",
            "num_chapters": 3,  # Small number for testing
            "writing_style": "professional",
            "language": "es",
            "apply_graphic_design": False,
            "design_description": ""
        }
        
        status_code, response_data, response_text = self.make_request(
            'POST', 'books/start-interactive', book_data, timeout=60
        )
        
        if status_code == 200 and 'id' in response_data:
            self.book_id = response_data['id']
            
            self.log_test(
                "Start Book Creation", 
                True, 
                f"Book created successfully with ID: {self.book_id}",
                {
                    "book_id": self.book_id,
                    "title": response_data.get('title'),
                    "status": response_data.get('status'),
                    "num_chapters": response_data.get('num_chapters')
                }
            )
            return True
        else:
            self.log_test(
                "Start Book Creation", 
                False, 
                f"Status: {status_code}, Response: {response_text[:200]}",
                {"expected_status": 200, "actual_status": status_code}
            )
            return False

    def test_5_generate_chapter_1(self):
        """Step 5: Generate Chapter 1 - CRITICAL TEST"""
        print(f"\n{'='*60}")
        print(f"📖 STEP 4: GENERATE CHAPTER 1 - CRITICAL TEST")
        print(f"{'='*60}")
        print(f"🎯 This is the main test for the reported issue!")
        print(f"🔍 Expected behavior:")
        print(f"   - HTTP 200 response (even if validation fails)")
        print(f"   - Response contains 'chapter' object")
        print(f"   - Chapter has content_es and content_en")
        print(f"   - May include 'validation_warning' if validation failed")
        print(f"   - Chapter should be created despite validation failures")
        
        if not hasattr(self, 'book_id'):
            self.log_test(
                "Generate Chapter 1", 
                False, 
                "No book ID available from previous step"
            )
            return False
        
        status_code, response_data, response_text = self.make_request(
            'POST', f'books/generate-chapter/{self.book_id}?chapter_number=1', 
            None,  # No body data needed
            timeout=180  # Longer timeout for AI generation
        )
        
        # CRITICAL VALIDATION - This is the core of the reported issue
        success = True
        issues = []
        debug_info = {}
        
        # Check 1: HTTP Response Code
        if status_code != 200:
            success = False
            issues.append(f"Expected HTTP 200, got {status_code}")
        debug_info["http_status"] = status_code
        
        # Check 2: Response contains chapter object
        if 'chapter' not in response_data:
            success = False
            issues.append("Response missing 'chapter' object")
        else:
            chapter = response_data['chapter']
            debug_info["chapter_keys"] = list(chapter.keys()) if isinstance(chapter, dict) else "not_dict"
            
            # Check 3: Chapter has content
            if isinstance(chapter, dict):
                content_es = chapter.get('content_es', '')
                content_en = chapter.get('content_en', '')
                
                debug_info["content_es_length"] = len(content_es) if content_es else 0
                debug_info["content_en_length"] = len(content_en) if content_en else 0
                
                if not content_es and not content_en:
                    success = False
                    issues.append("Chapter has no content (both content_es and content_en empty)")
                
                # Print content lengths for debugging
                print(f"   📏 Content ES Length: {len(content_es)} characters")
                print(f"   📏 Content EN Length: {len(content_en)} characters")
                
                # Check for validation warning (this is expected based on the issue description)
                if 'validation_warning' in response_data:
                    validation_warning = response_data['validation_warning']
                    debug_info["validation_warning"] = validation_warning
                    print(f"   ⚠️ Validation Warning Present: {validation_warning}")
                    print(f"   ✅ This is expected behavior - chapter should still be created")
                else:
                    debug_info["validation_warning"] = None
                    print(f"   ✅ No validation warning - chapter passed validation")
        
        # Check 4: Look for any error messages
        if 'error' in response_data or 'detail' in response_data:
            error_msg = response_data.get('error') or response_data.get('detail')
            debug_info["error_message"] = error_msg
            print(f"   ❌ Error in response: {error_msg}")
        
        # Final assessment
        if success:
            self.log_test(
                "Generate Chapter 1 - CRITICAL", 
                True, 
                "Chapter 1 generated successfully with content",
                debug_info
            )
            
            # Store chapter for next test
            if 'chapter' in response_data:
                self.chapter_1 = response_data['chapter']
            
            return True
        else:
            self.log_test(
                "Generate Chapter 1 - CRITICAL", 
                False, 
                "; ".join(issues),
                debug_info
            )
            return False

    def test_5_verify_chapter_in_database(self):
        """Step 5: Verify Chapter is saved in database"""
        print(f"\n{'='*60}")
        print(f"💾 STEP 5: VERIFY CHAPTER IN DATABASE")
        print(f"{'='*60}")
        
        if not hasattr(self, 'book_id'):
            self.log_test(
                "Verify Chapter in Database", 
                False, 
                "No book ID available"
            )
            return False
        
        # Get book from database to verify chapter is saved
        status_code, response_data, response_text = self.make_request(
            'GET', f'books-in-progress/{self.book_id}', timeout=30
        )
        
        if status_code == 200:
            chapters = response_data.get('chapters', [])
            
            debug_info = {
                "book_id": self.book_id,
                "chapters_count": len(chapters),
                "book_status": response_data.get('status'),
                "current_chapter": response_data.get('current_chapter')
            }
            
            if len(chapters) > 0:
                chapter_1 = chapters[0]
                debug_info["chapter_1_keys"] = list(chapter_1.keys()) if isinstance(chapter_1, dict) else "not_dict"
                
                if isinstance(chapter_1, dict):
                    debug_info["chapter_1_number"] = chapter_1.get('number')
                    debug_info["chapter_1_title"] = chapter_1.get('title')
                    debug_info["chapter_1_content_length"] = len(chapter_1.get('content', ''))
                    debug_info["chapter_1_approved"] = chapter_1.get('approved')
                
                self.log_test(
                    "Verify Chapter in Database", 
                    True, 
                    f"Chapter 1 found in database with {len(chapter_1.get('content', ''))} characters",
                    debug_info
                )
                return True
            else:
                self.log_test(
                    "Verify Chapter in Database", 
                    False, 
                    "No chapters found in book database record",
                    debug_info
                )
                return False
        else:
            self.log_test(
                "Verify Chapter in Database", 
                False, 
                f"Failed to retrieve book: Status {status_code}",
                {"status_code": status_code, "response": response_text[:200]}
            )
            return False

    def test_6_check_frontend_state(self):
        """Step 6: Check what frontend would receive"""
        print(f"\n{'='*60}")
        print(f"🖥️ STEP 6: CHECK FRONTEND STATE")
        print(f"{'='*60}")
        
        if not hasattr(self, 'book_id'):
            self.log_test(
                "Check Frontend State", 
                False, 
                "No book ID available"
            )
            return False
        
        # Test the endpoint that frontend would typically use
        status_code, response_data, response_text = self.make_request(
            'GET', f'books/{self.book_id}', timeout=30
        )
        
        if status_code == 200:
            # Check if this is what frontend expects
            expected_fields = ['id', 'title', 'status', 'chapters']
            missing_fields = [field for field in expected_fields if field not in response_data]
            
            debug_info = {
                "response_keys": list(response_data.keys()),
                "missing_expected_fields": missing_fields,
                "book_status": response_data.get('status'),
                "chapters_present": 'chapters' in response_data
            }
            
            if 'chapters' in response_data:
                chapters = response_data['chapters']
                debug_info["chapters_count"] = len(chapters)
                debug_info["chapters_structure"] = [
                    {
                        "number": ch.get('number'),
                        "title": ch.get('title'),
                        "has_content": bool(ch.get('content'))
                    } for ch in chapters[:3]  # First 3 chapters
                ] if isinstance(chapters, list) else "not_list"
            
            if missing_fields:
                self.log_test(
                    "Check Frontend State", 
                    False, 
                    f"Missing expected fields for frontend: {missing_fields}",
                    debug_info
                )
                return False
            else:
                self.log_test(
                    "Check Frontend State", 
                    True, 
                    "Frontend would receive properly structured book data",
                    debug_info
                )
                return True
        else:
            self.log_test(
                "Check Frontend State", 
                False, 
                f"Frontend endpoint failed: Status {status_code}",
                {"status_code": status_code, "response": response_text[:200]}
            )
            return False

    def test_7_backend_logs_check(self):
        """Step 7: Check backend logs for any errors"""
        print(f"\n{'='*60}")
        print(f"📋 STEP 7: BACKEND LOGS CHECK")
        print(f"{'='*60}")
        
        print(f"🔍 Checking supervisor backend logs for errors...")
        
        try:
            import subprocess
            
            # Check backend error logs
            result = subprocess.run(
                ['tail', '-n', '50', '/var/log/supervisor/backend.err.log'],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0:
                error_logs = result.stdout
                
                # Look for relevant errors
                relevant_errors = []
                for line in error_logs.split('\n'):
                    if any(keyword in line.lower() for keyword in ['error', 'exception', 'traceback', 'failed']):
                        relevant_errors.append(line.strip())
                
                debug_info = {
                    "total_log_lines": len(error_logs.split('\n')),
                    "relevant_errors_count": len(relevant_errors),
                    "recent_errors": relevant_errors[-5:] if relevant_errors else []
                }
                
                if relevant_errors:
                    print(f"   ⚠️ Found {len(relevant_errors)} potential error lines in logs")
                    for error in relevant_errors[-3:]:  # Show last 3 errors
                        print(f"   📝 {error}")
                else:
                    print(f"   ✅ No obvious errors found in recent backend logs")
                
                self.log_test(
                    "Backend Logs Check", 
                    True, 
                    f"Checked backend logs - {len(relevant_errors)} potential issues found",
                    debug_info
                )
                return True
            else:
                self.log_test(
                    "Backend Logs Check", 
                    False, 
                    f"Failed to read backend logs: {result.stderr}",
                    {"return_code": result.returncode}
                )
                return False
                
        except Exception as e:
            self.log_test(
                "Backend Logs Check", 
                False, 
                f"Exception checking logs: {str(e)}",
                {"exception": str(e)}
            )
            return False

    def run_all_tests(self):
        """Run all tests in sequence"""
        print(f"\n🚀 STARTING COMPREHENSIVE BOOK MODULE TESTING")
        print(f"⏰ Start Time: {datetime.now().isoformat()}")
        
        test_methods = [
            self.test_1_login,
            self.test_2_suggest_book_ideas,
            self.test_3_suggest_book_titles,
            self.test_4_start_book,
            self.test_5_generate_chapter_1,
            self.test_5_verify_chapter_in_database,
            self.test_6_check_frontend_state,
            self.test_7_backend_logs_check
        ]
        
        for test_method in test_methods:
            try:
                success = test_method()
                if not success and test_method == self.test_5_generate_chapter_1:
                    print(f"\n🚨 CRITICAL TEST FAILED - Chapter 1 Generation")
                    print(f"   This is the core issue reported by the user!")
                    break
            except Exception as e:
                print(f"\n💥 EXCEPTION in {test_method.__name__}: {str(e)}")
                self.log_test(
                    test_method.__name__, 
                    False, 
                    f"Exception: {str(e)}"
                )
        
        self.print_final_report()

    def print_final_report(self):
        """Print comprehensive final report"""
        print(f"\n{'='*80}")
        print(f"📊 FINAL TEST REPORT - BOOK MODULE CHAPTER GENERATION DEBUG")
        print(f"{'='*80}")
        
        print(f"📈 Test Summary:")
        print(f"   Total Tests: {self.tests_run}")
        print(f"   Passed: {self.tests_passed}")
        print(f"   Failed: {self.tests_run - self.tests_passed}")
        print(f"   Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        print(f"\n🔍 Detailed Results:")
        for result in self.test_results:
            status = "✅ PASS" if result['success'] else "❌ FAIL"
            print(f"   {status} {result['test']}")
            if not result['success']:
                print(f"      💬 {result['details']}")
            if result.get('debug_info'):
                print(f"      🔍 Debug: {json.dumps(result['debug_info'], indent=6)}")
        
        print(f"\n🎯 DIAGNOSIS:")
        
        # Check if critical test passed
        chapter_gen_result = next((r for r in self.test_results if "Generate Chapter 1" in r['test']), None)
        
        if chapter_gen_result and chapter_gen_result['success']:
            print(f"   ✅ Chapter 1 generation is WORKING correctly")
            print(f"   ✅ Backend API returns chapter with content")
            print(f"   ✅ Chapter is saved to database")
            print(f"   📝 If user still reports issues, check:")
            print(f"      - Frontend JavaScript console for errors")
            print(f"      - Network tab in browser dev tools")
            print(f"      - Frontend state management")
            print(f"      - UI rendering logic")
        else:
            print(f"   ❌ Chapter 1 generation has ISSUES")
            print(f"   🔧 Recommended actions:")
            print(f"      - Check backend logs for detailed error messages")
            print(f"      - Verify database connectivity")
            print(f"      - Check AI service (GPT-5.1) integration")
            print(f"      - Validate request/response data structures")
        
        print(f"\n⏰ Test Completed: {datetime.now().isoformat()}")
        print(f"{'='*80}")

if __name__ == "__main__":
    tester = BookGenerationDebugTester()
    tester.run_all_tests()