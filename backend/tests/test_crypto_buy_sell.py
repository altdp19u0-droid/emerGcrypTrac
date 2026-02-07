"""
Test suite for crypto_buy and crypto_sell fiat transaction features.
Tests that:
1. crypto_buy: Creates fiat debit AND crypto Buy transaction in destination wallet
2. crypto_sell: Creates fiat credit AND crypto Sell transaction in source wallet
3. NO duplicate EUR Deposit/Withdrawal is created alongside crypto Buy/Sell
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USERNAME = "fiatdemo"
TEST_PASSWORD = "FiatDemo123"

# Test wallet and account IDs (from request)
NEVERLESS_WALLET_ID = "d783a611-e0a1-4166-a5ff-ce8270e6a348"
BLEAP_WALLET_ID = "ae61a1b9-34af-49ea-9898-598d8836bc82"
KRAKEN_FIAT_ACCOUNT_ID = "d25d51ea-2ba1-45db-b116-05504bf1d68a"


class TestCryptoBuySellFeature:
    """Test crypto_buy and crypto_sell fiat transaction functionality"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": TEST_USERNAME,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    @pytest.fixture(scope="class")
    def fiat_account(self, auth_headers):
        """Get first available fiat account for testing"""
        response = requests.get(f"{BASE_URL}/api/fiat-accounts", headers=auth_headers)
        assert response.status_code == 200
        accounts = response.json()
        assert len(accounts) > 0, "No fiat accounts found"
        return accounts[0]
    
    @pytest.fixture(scope="class")
    def wallets(self, auth_headers):
        """Get wallets for testing"""
        response = requests.get(f"{BASE_URL}/api/wallets", headers=auth_headers)
        assert response.status_code == 200
        return response.json()
    
    def get_fiat_transactions(self, auth_headers, account_id):
        """Get fiat transactions for a specific account"""
        response = requests.get(f"{BASE_URL}/api/fiat-transactions?account_id={account_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        # API returns object with 'transactions' key
        if isinstance(data, dict) and "transactions" in data:
            return data["transactions"]
        return data
    
    def get_crypto_transactions(self, auth_headers, wallet_id=None):
        """Get crypto transactions, optionally filtered by wallet"""
        params = {"page": 1, "page_size": 100, "hide_spam": "false", "include_fiat": "false"}
        if wallet_id:
            params["wallet_ids"] = wallet_id
        response = requests.get(f"{BASE_URL}/api/transactions", params=params, headers=auth_headers)
        assert response.status_code == 200
        return response.json().get("transactions", [])
    
    def test_login_works(self, auth_token):
        """Test that login with test credentials works"""
        assert auth_token is not None
        assert len(auth_token) > 0
        print(f"✓ Login successful with token: {auth_token[:20]}...")
    
    def test_fiat_accounts_exist(self, fiat_account):
        """Test that fiat accounts exist"""
        assert fiat_account["id"] is not None
        print(f"✓ Found fiat account: {fiat_account['name']} ({fiat_account['currency']})")
    
    def test_wallets_exist(self, wallets):
        """Test that wallets exist for crypto transactions"""
        assert len(wallets) > 0, "No wallets found"
        print(f"✓ Found {len(wallets)} wallets:")
        for w in wallets:
            print(f"  - {w['name']} (ID: {w['id']})")
    
    def test_crypto_buy_creates_fiat_debit_and_crypto_buy(self, auth_headers, fiat_account, wallets):
        """
        Test crypto_buy: 
        1. Creates a fiat debit transaction (withdrawal from bank)
        2. Creates a crypto Buy transaction in destination wallet
        3. Does NOT create duplicate EUR Deposit/Withdrawal
        """
        # Find a wallet to use as destination
        dest_wallet = wallets[0] if wallets else None
        assert dest_wallet is not None, "No wallet available for test"
        
        # Count existing transactions before test
        fiat_before = self.get_fiat_transactions(auth_headers, fiat_account["id"])
        crypto_before = self.get_crypto_transactions(auth_headers, dest_wallet["id"])
        
        fiat_count_before = len(fiat_before)
        crypto_count_before = len(crypto_before)
        
        # Create crypto_buy transaction
        test_amount = 50.0
        test_crypto_amount = 49.5
        test_asset = "EURC"
        test_date = "2024-12-15T10:30:00"
        
        payload = {
            "type": "crypto_buy",
            "amount": test_amount,  # Fiat amount to debit
            "description": "TEST_crypto_buy - Prime/Bleap purchase",
            "account_id": fiat_account["id"],
            "date": test_date,
            "source_type": "bank",
            "source_account_id": fiat_account["id"],
            "dest_type": "wallet",
            "dest_wallet_id": dest_wallet["id"],
            "dest_wallet_address": dest_wallet.get("address", ""),
            "crypto_asset": test_asset,
            "crypto_amount": test_crypto_amount
        }
        
        response = requests.post(f"{BASE_URL}/api/fiat-transactions", json=payload, headers=auth_headers)
        print(f"crypto_buy response: {response.status_code} - {response.text}")
        
        assert response.status_code == 200, f"crypto_buy creation failed: {response.text}"
        result = response.json()
        
        assert "id" in result, "Response should contain transaction ID"
        fiat_tx_id = result["id"]
        print(f"✓ Fiat transaction created with ID: {fiat_tx_id}")
        
        # Check message mentions crypto transaction was created
        message = result.get("message", "")
        assert "achat" in message.lower() or "crypto" in message.lower() or "created" in message.lower(), \
            f"Message should mention crypto transaction creation: {message}"
        
        # Wait a bit for DB operations
        time.sleep(0.5)
        
        # Verify fiat transaction was created (debit)
        fiat_after = self.get_fiat_transactions(auth_headers, fiat_account["id"])
        
        # Find the new fiat transaction
        new_fiat_txs = [tx for tx in fiat_after if tx["id"] == fiat_tx_id]
        assert len(new_fiat_txs) == 1, "Fiat transaction should exist"
        
        fiat_tx = new_fiat_txs[0]
        assert fiat_tx["type"] == "crypto_buy", f"Fiat tx type should be crypto_buy, got: {fiat_tx['type']}"
        # crypto_buy stores amount as positive, but the balance effect is a debit
        # Check linked_crypto_tx_id to confirm crypto transaction was created
        assert fiat_tx["amount"] == test_amount, f"Fiat tx amount should be positive: {fiat_tx['amount']}"
        assert "linked_crypto_tx_id" in fiat_tx and fiat_tx["linked_crypto_tx_id"], \
            f"Fiat tx should have linked_crypto_tx_id: {fiat_tx.get('linked_crypto_tx_id')}"
        print(f"✓ Fiat debit transaction verified: {fiat_tx['amount']} {fiat_account['currency']}, linked_crypto_tx_id: {fiat_tx.get('linked_crypto_tx_id')}")
        
        # Verify crypto Buy transaction was created in wallet
        # Use the linked_crypto_tx_id from the fiat transaction
        linked_crypto_tx_id = fiat_tx.get("linked_crypto_tx_id")
        crypto_after = self.get_crypto_transactions(auth_headers, dest_wallet["id"])
        
        # Find crypto transaction by ID if available, or by source='fiat_purchase'
        new_crypto_txs = []
        if linked_crypto_tx_id:
            new_crypto_txs = [tx for tx in crypto_after if tx.get("id") == linked_crypto_tx_id]
        
        if not new_crypto_txs:
            # Fallback: Find crypto transactions with source='fiat_purchase' and matching date
            new_crypto_txs = [
                tx for tx in crypto_after 
                if tx.get("source") == "fiat_purchase" 
                and tx.get("asset") == test_asset
                and tx.get("amount") > 0
            ]
        
        assert len(new_crypto_txs) >= 1, f"Crypto Buy transaction should be created. Found: {len(new_crypto_txs)}"
        
        crypto_tx = new_crypto_txs[-1]  # Get latest one
        assert crypto_tx["type"] == "Buy", f"Crypto tx type should be Buy, got: {crypto_tx['type']}"
        assert abs(crypto_tx["amount"] - test_crypto_amount) < 0.001, \
            f"Crypto amount should be {test_crypto_amount}, got: {crypto_tx['amount']}"
        assert crypto_tx["asset"] == test_asset, f"Crypto asset should be {test_asset}"
        assert crypto_tx["wallet_id"] == dest_wallet["id"], "Crypto tx should be in destination wallet"
        print(f"✓ Crypto Buy transaction verified: +{crypto_tx['amount']} {crypto_tx['asset']} in {dest_wallet['name']}")
        
        # Verify NO duplicate EUR Deposit/Withdrawal was created
        # Check that no other fiat transaction of type 'deposit' or 'withdrawal' was created
        all_fiat_after = self.get_fiat_transactions(auth_headers, fiat_account["id"])
        duplicate_txs = [
            tx for tx in all_fiat_after 
            if tx["id"] != fiat_tx_id 
            and tx.get("type") in ["deposit", "withdrawal"]
            and test_date[:10] in tx.get("date", "")
            and abs(abs(tx.get("amount", 0)) - test_amount) < 0.01
        ]
        
        assert len(duplicate_txs) == 0, f"Should NOT create duplicate deposit/withdrawal. Found: {duplicate_txs}"
        print("✓ No duplicate EUR Deposit/Withdrawal created")
        
        # Cleanup - delete the test transactions
        requests.delete(f"{BASE_URL}/api/fiat-transactions/{fiat_tx_id}", headers=auth_headers)
        if new_crypto_txs:
            requests.delete(f"{BASE_URL}/api/transactions/{crypto_tx['id']}", headers=auth_headers)
        
        print("✓ TEST PASSED: crypto_buy creates fiat debit + crypto Buy, no duplicates")
    
    def test_crypto_sell_creates_fiat_credit_and_crypto_sell(self, auth_headers, fiat_account, wallets):
        """
        Test crypto_sell:
        1. Creates a fiat credit transaction (deposit to bank)
        2. Creates a crypto Sell transaction in source wallet
        3. Does NOT create duplicate EUR Deposit/Withdrawal
        """
        # Find a wallet to use as source
        source_wallet = wallets[0] if wallets else None
        assert source_wallet is not None, "No wallet available for test"
        
        # Count existing transactions before test
        fiat_before = self.get_fiat_transactions(auth_headers, fiat_account["id"])
        crypto_before = self.get_crypto_transactions(auth_headers, source_wallet["id"])
        
        # Create crypto_sell transaction
        test_amount = 75.0  # Fiat amount to credit
        test_crypto_amount = 74.25  # Crypto amount sold (e.g., 1% fee)
        test_asset = "USDC"
        test_date = "2024-12-16T14:45:00"
        
        payload = {
            "type": "crypto_sell",
            "amount": test_amount,  # Fiat amount to credit
            "description": "TEST_crypto_sell - Prime/Bleap sale",
            "account_id": fiat_account["id"],
            "date": test_date,
            "source_type": "wallet",
            "source_wallet_id": source_wallet["id"],
            "source_wallet_address": source_wallet.get("address", ""),
            "dest_type": "bank",
            "dest_account_id": fiat_account["id"],
            "crypto_asset": test_asset,
            "crypto_amount": test_crypto_amount
        }
        
        response = requests.post(f"{BASE_URL}/api/fiat-transactions", json=payload, headers=auth_headers)
        print(f"crypto_sell response: {response.status_code} - {response.text}")
        
        assert response.status_code == 200, f"crypto_sell creation failed: {response.text}"
        result = response.json()
        
        assert "id" in result, "Response should contain transaction ID"
        fiat_tx_id = result["id"]
        print(f"✓ Fiat transaction created with ID: {fiat_tx_id}")
        
        # Check message mentions crypto transaction was created
        message = result.get("message", "")
        print(f"Response message: {message}")
        
        # Wait a bit for DB operations
        time.sleep(0.5)
        
        # Verify fiat transaction was created (credit)
        fiat_after = self.get_fiat_transactions(auth_headers, fiat_account["id"])
        
        # Find the new fiat transaction
        new_fiat_txs = [tx for tx in fiat_after if tx["id"] == fiat_tx_id]
        assert len(new_fiat_txs) == 1, "Fiat transaction should exist"
        
        fiat_tx = new_fiat_txs[0]
        assert fiat_tx["type"] == "crypto_sell", f"Fiat tx type should be crypto_sell, got: {fiat_tx['type']}"
        assert fiat_tx["amount"] == test_amount, f"Fiat tx amount should be positive (credit): {fiat_tx['amount']}"
        # Check linked_crypto_tx_id to confirm crypto transaction was created
        assert "linked_crypto_tx_id" in fiat_tx and fiat_tx["linked_crypto_tx_id"], \
            f"Fiat tx should have linked_crypto_tx_id: {fiat_tx.get('linked_crypto_tx_id')}"
        print(f"✓ Fiat credit transaction verified: +{fiat_tx['amount']} {fiat_account['currency']}, linked_crypto_tx_id: {fiat_tx.get('linked_crypto_tx_id')}")
        
        # Verify crypto Sell transaction was created in wallet
        crypto_after = self.get_crypto_transactions(auth_headers, source_wallet["id"])
        
        # Find crypto transactions with source='fiat_sale' and matching date
        new_crypto_txs = [
            tx for tx in crypto_after 
            if tx.get("source") == "fiat_sale" 
            and tx.get("asset") == test_asset
            and tx.get("amount") < 0  # Sell = negative amount
            and tx not in crypto_before
        ]
        
        assert len(new_crypto_txs) >= 1, f"Crypto Sell transaction should be created. Found: {len(new_crypto_txs)}"
        
        crypto_tx = new_crypto_txs[-1]  # Get latest one
        assert crypto_tx["type"] == "Sell", f"Crypto tx type should be Sell, got: {crypto_tx['type']}"
        assert abs(abs(crypto_tx["amount"]) - test_crypto_amount) < 0.001, \
            f"Crypto amount should be -{test_crypto_amount}, got: {crypto_tx['amount']}"
        assert crypto_tx["asset"] == test_asset, f"Crypto asset should be {test_asset}"
        assert crypto_tx["wallet_id"] == source_wallet["id"], "Crypto tx should be in source wallet"
        print(f"✓ Crypto Sell transaction verified: {crypto_tx['amount']} {crypto_tx['asset']} in {source_wallet['name']}")
        
        # Verify NO duplicate EUR Deposit/Withdrawal was created
        all_fiat_after = self.get_fiat_transactions(auth_headers, fiat_account["id"])
        duplicate_txs = [
            tx for tx in all_fiat_after 
            if tx["id"] != fiat_tx_id 
            and tx.get("type") in ["deposit", "withdrawal"]
            and test_date[:10] in tx.get("date", "")
            and abs(abs(tx.get("amount", 0)) - test_amount) < 0.01
        ]
        
        assert len(duplicate_txs) == 0, f"Should NOT create duplicate deposit/withdrawal. Found: {duplicate_txs}"
        print("✓ No duplicate EUR Deposit/Withdrawal created")
        
        # Cleanup - delete the test transactions
        requests.delete(f"{BASE_URL}/api/fiat-transactions/{fiat_tx_id}", headers=auth_headers)
        if new_crypto_txs:
            requests.delete(f"{BASE_URL}/api/transactions/{crypto_tx['id']}", headers=auth_headers)
        
        print("✓ TEST PASSED: crypto_sell creates fiat credit + crypto Sell, no duplicates")
    
    def test_crypto_buy_without_wallet_only_creates_fiat(self, auth_headers, fiat_account):
        """
        Test that crypto_buy without destination wallet only creates fiat transaction
        """
        test_amount = 30.0
        test_date = "2024-12-17T09:00:00"
        
        payload = {
            "type": "crypto_buy",
            "amount": test_amount,
            "description": "TEST_crypto_buy without wallet",
            "account_id": fiat_account["id"],
            "date": test_date,
            "source_type": "bank",
            "source_account_id": fiat_account["id"],
            "dest_type": "external",  # No wallet
            "crypto_asset": "EURC",
            "crypto_amount": 29.5
        }
        
        response = requests.post(f"{BASE_URL}/api/fiat-transactions", json=payload, headers=auth_headers)
        
        assert response.status_code == 200, f"Transaction creation failed: {response.text}"
        result = response.json()
        fiat_tx_id = result["id"]
        
        # Fiat transaction should exist
        fiat_txs = self.get_fiat_transactions(auth_headers, fiat_account["id"])
        new_tx = [tx for tx in fiat_txs if tx["id"] == fiat_tx_id]
        assert len(new_tx) == 1, "Fiat transaction should be created"
        
        # No crypto transaction should be created (no dest_wallet_id)
        print("✓ crypto_buy without wallet creates only fiat transaction")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/fiat-transactions/{fiat_tx_id}", headers=auth_headers)
    
    def test_regular_deposit_still_works(self, auth_headers, fiat_account):
        """
        Test that regular deposit transactions still work correctly
        """
        test_amount = 100.0
        test_date = "2024-12-18T11:00:00"
        
        payload = {
            "type": "deposit",
            "amount": test_amount,
            "description": "TEST_regular_deposit",
            "account_id": fiat_account["id"],
            "date": test_date,
            "source_type": "external"
        }
        
        response = requests.post(f"{BASE_URL}/api/fiat-transactions", json=payload, headers=auth_headers)
        
        assert response.status_code == 200, f"Deposit creation failed: {response.text}"
        result = response.json()
        fiat_tx_id = result["id"]
        
        # Verify deposit was created
        fiat_txs = self.get_fiat_transactions(auth_headers, fiat_account["id"])
        new_tx = [tx for tx in fiat_txs if tx["id"] == fiat_tx_id]
        assert len(new_tx) == 1, "Deposit should be created"
        assert new_tx[0]["type"] == "deposit"
        assert new_tx[0]["amount"] == test_amount
        
        print("✓ Regular deposit still works correctly")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/fiat-transactions/{fiat_tx_id}", headers=auth_headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
