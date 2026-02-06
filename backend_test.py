#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class CryptoTrackAPITester:
    def __init__(self, base_url="https://new-start-6.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    Details: {details}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}, Expected: {expected_status}"
            
            if not success:
                try:
                    error_detail = response.json()
                    details += f", Response: {error_detail}"
                except:
                    details += f", Response: {response.text[:200]}"
            
            self.log_test(name, success, details)
            
            if success:
                try:
                    return True, response.json()
                except:
                    return True, response.text
            else:
                return False, {}

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_login(self, username, password):
        """Test login and get token"""
        print(f"\n🔐 Testing login with {username}...")
        success, response = self.run_test(
            "Login",
            "POST",
            "auth/login",
            200,
            data={"username": username, "password": password}
        )
        
        if success and isinstance(response, dict) and 'access_token' in response:
            self.token = response['access_token']
            print(f"✅ Login successful, token obtained")
            return True
        else:
            print(f"❌ Login failed")
            return False

    def test_fiat_accounts(self):
        """Test fiat accounts endpoints"""
        print(f"\n💰 Testing Fiat Accounts...")
        
        # Get existing accounts
        success, accounts_response = self.run_test(
            "Get Fiat Accounts",
            "GET", 
            "fiat-accounts",
            200
        )
        
        if not success:
            return False
            
        accounts = accounts_response if isinstance(accounts_response, list) else []
        print(f"Found {len(accounts)} existing fiat accounts")
        
        return True

    def test_fiat_transactions_crud(self):
        """Test CRUD operations for fiat transactions"""
        print(f"\n💳 Testing Fiat Transactions CRUD...")
        
        # First get accounts to work with
        success, accounts_response = self.run_test(
            "Get Fiat Accounts for Transactions",
            "GET",
            "fiat-accounts", 
            200
        )
        
        if not success:
            return False
            
        accounts = accounts_response if isinstance(accounts_response, list) else []
        if not accounts:
            print("❌ No fiat accounts found - cannot test transactions")
            return False
            
        account = accounts[0]
        account_id = account['id']
        print(f"Using account: {account['name']} ({account_id})")
        
        # 1. Create a test transaction
        test_transaction = {
            "type": "deposit",
            "amount": 100.50,
            "description": "Test transaction for editing",
            "account_id": account_id,
            "date": "2024-01-15T10:30:00",
            "source_type": "external",
            "dest_type": "bank",
            "dest_account_id": account_id
        }
        
        success, create_response = self.run_test(
            "Create Fiat Transaction",
            "POST",
            "fiat-transactions",
            200,
            data=test_transaction
        )
        
        if not success:
            return False
            
        transaction_id = create_response.get('id')
        if not transaction_id:
            self.log_test("Get Transaction ID", False, "No transaction ID returned")
            return False
            
        print(f"✅ Created transaction with ID: {transaction_id}")
        
        # 2. Get transactions to verify creation
        success, transactions_response = self.run_test(
            "Get Fiat Transactions",
            "GET",
            f"fiat-transactions?account_id={account_id}",
            200
        )
        
        if not success:
            return False
            
        transactions = transactions_response.get('transactions', [])
        created_tx = None
        for tx in transactions:
            if tx.get('id') == transaction_id:
                created_tx = tx
                break
                
        if not created_tx:
            self.log_test("Find Created Transaction", False, "Transaction not found in list")
            return False
            
        print(f"✅ Found created transaction: {created_tx.get('description')}")
        
        # 3. Test UPDATE (PUT) - This is the main feature being tested
        update_data = {
            "description": "Updated test transaction description",
            "amount": 150.75,
            "type": "deposit"
        }
        
        success, update_response = self.run_test(
            "Update Fiat Transaction (PUT)",
            "PUT",
            f"fiat-transactions/{transaction_id}",
            200,
            data=update_data
        )
        
        if not success:
            return False
            
        print(f"✅ Updated transaction successfully")
        
        # 4. Verify the update by getting transactions again
        success, verify_response = self.run_test(
            "Verify Transaction Update",
            "GET",
            f"fiat-transactions?account_id={account_id}",
            200
        )
        
        if success:
            transactions = verify_response.get('transactions', [])
            updated_tx = None
            for tx in transactions:
                if tx.get('id') == transaction_id:
                    updated_tx = tx
                    break
                    
            if updated_tx:
                if updated_tx.get('description') == update_data['description']:
                    self.log_test("Verify Description Update", True, f"Description updated to: {updated_tx.get('description')}")
                else:
                    self.log_test("Verify Description Update", False, f"Expected: {update_data['description']}, Got: {updated_tx.get('description')}")
                    
                if abs(updated_tx.get('amount', 0) - update_data['amount']) < 0.01:
                    self.log_test("Verify Amount Update", True, f"Amount updated to: {updated_tx.get('amount')}")
                else:
                    self.log_test("Verify Amount Update", False, f"Expected: {update_data['amount']}, Got: {updated_tx.get('amount')}")
            else:
                self.log_test("Find Updated Transaction", False, "Updated transaction not found")
        
        # 5. Test DELETE
        success, delete_response = self.run_test(
            "Delete Fiat Transaction",
            "DELETE",
            f"fiat-transactions/{transaction_id}",
            200
        )
        
        if success:
            print(f"✅ Deleted transaction successfully")
            
            # Verify deletion
            success, verify_delete_response = self.run_test(
                "Verify Transaction Deletion",
                "GET",
                f"fiat-transactions?account_id={account_id}",
                200
            )
            
            if success:
                transactions = verify_delete_response.get('transactions', [])
                deleted_tx = None
                for tx in transactions:
                    if tx.get('id') == transaction_id:
                        deleted_tx = tx
                        break
                        
                if not deleted_tx:
                    self.log_test("Verify Transaction Deleted", True, "Transaction successfully removed from list")
                else:
                    self.log_test("Verify Transaction Deleted", False, "Transaction still exists after deletion")
        
        return True

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print(f"\n🔑 Testing Authentication...")
        
        # Test /auth/me endpoint
        success, me_response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        
        if success:
            print(f"✅ Current user: {me_response.get('username')}")
        
        return success

    def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting CryptoTrack API Tests...")
        print(f"Backend URL: {self.base_url}")
        
        # Test login with provided credentials
        if not self.test_login("fiatdemo", "FiatDemo123"):
            print("❌ Login failed - cannot continue with other tests")
            return False
        
        # Test authentication
        self.test_auth_endpoints()
        
        # Test fiat accounts
        self.test_fiat_accounts()
        
        # Test fiat transactions CRUD (main focus)
        self.test_fiat_transactions_crud()
        
        # Print summary
        print(f"\n📊 Test Summary:")
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    tester = CryptoTrackAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump({
            'summary': {
                'tests_run': tester.tests_run,
                'tests_passed': tester.tests_passed,
                'success_rate': (tester.tests_passed/tester.tests_run*100) if tester.tests_run > 0 else 0,
                'timestamp': datetime.now().isoformat()
            },
            'results': tester.test_results
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())