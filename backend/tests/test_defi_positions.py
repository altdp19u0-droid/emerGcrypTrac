"""
Tests for DeFi positions API - verifies EUR value calculation for tokens like 8LNDS
Bug report: The 'Net' value for 8LNDS was showing token quantity (2005.009) instead of EUR value (~€18.45)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDeFiPositions:
    """Tests for the /api/defi/positions endpoint and EUR value calculations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test by logging in"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "fiatdemo",
            "password": "FiatDemo123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_defi_positions_endpoint_returns_200(self):
        """Test that the /api/defi/positions endpoint returns 200"""
        response = self.session.get(f"{BASE_URL}/api/defi/positions")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "positions" in data, "Response should contain 'positions' key"
        print(f"✓ DeFi positions endpoint returns 200 with {len(data['positions'])} protocols")
    
    def test_8lends_position_exists(self):
        """Test that 8LENDS position exists in the response"""
        response = self.session.get(f"{BASE_URL}/api/defi/positions")
        assert response.status_code == 200
        
        data = response.json()
        positions = data.get("positions", {})
        
        assert "8LENDS" in positions, "8LENDS protocol should exist in positions"
        print(f"✓ 8LENDS position found")
    
    def test_8lnds_eur_value_calculation(self):
        """
        CRITICAL TEST: Verify 8LNDS token shows EUR value, not token quantity.
        
        Bug: The Net value for 8LNDS was showing token quantity (2005.009) instead of EUR value (~€18.45)
        Fix: The API should return separate fields for token quantity (net_position) and EUR value (rewards_eur)
        """
        response = self.session.get(f"{BASE_URL}/api/defi/positions")
        assert response.status_code == 200
        
        data = response.json()
        positions = data.get("positions", {})
        
        # Check 8LENDS exists
        assert "8LENDS" in positions, "8LENDS protocol should exist"
        
        lends_position = positions["8LENDS"]
        assets = lends_position.get("assets", {})
        
        # Check 8LNDS asset exists
        assert "8LNDS" in assets, "8LNDS asset should exist in 8LENDS protocol"
        
        lnds_data = assets["8LNDS"]
        
        # The bug was that NET was showing token quantity instead of EUR value
        # The API should return:
        # - net_position: token quantity (should be ~2005)
        # - rewards_eur: EUR value (should be ~€18.45)
        
        net_position = lnds_data.get("net_position", 0)
        rewards_eur = lnds_data.get("rewards_eur", 0)
        deposits_eur = lnds_data.get("deposits_eur", 0)
        withdrawals_eur = lnds_data.get("withdrawals_eur", 0)
        
        # Calculate the actual NET EUR value: deposits + rewards - withdrawals (in EUR)
        net_value_eur = deposits_eur + rewards_eur - withdrawals_eur
        
        print(f"  8LNDS Token Quantity (net_position): {net_position:.2f} tokens")
        print(f"  8LNDS EUR Value (rewards_eur): €{rewards_eur:.2f}")
        print(f"  8LNDS Calculated Net EUR: €{net_value_eur:.2f}")
        
        # Verify the values are separate and make sense
        # Token quantity should be around 2005 (large number)
        assert net_position > 1000, f"Token quantity should be large (~2005), got {net_position}"
        
        # EUR value should be around 18.45 (small number for reward tokens)
        assert rewards_eur < 100, f"EUR rewards value should be small (~€18.45), got €{rewards_eur}"
        assert rewards_eur > 0, f"EUR rewards value should be positive, got €{rewards_eur}"
        
        # This is the critical check - the EUR value and token quantity should be DIFFERENT
        # If they were the same, it would indicate the bug is still present
        assert abs(net_position - rewards_eur) > 100, \
            f"EUR value (€{rewards_eur}) should NOT equal token quantity ({net_position}). Bug still present!"
        
        print(f"✓ CRITICAL CHECK PASSED: EUR value (€{rewards_eur:.2f}) is correctly different from token quantity ({net_position:.2f})")
    
    def test_usdc_position_in_8lends(self):
        """Test USDC position in 8LENDS has correct values"""
        response = self.session.get(f"{BASE_URL}/api/defi/positions")
        assert response.status_code == 200
        
        data = response.json()
        positions = data.get("positions", {})
        
        assert "8LENDS" in positions, "8LENDS should exist"
        usdc_data = positions["8LENDS"].get("assets", {}).get("USDC", {})
        
        # For USDC (stablecoin), token quantity and EUR value should be close to 1:1
        deposits = usdc_data.get("deposits", 0)
        deposits_eur = usdc_data.get("deposits_eur", 0)
        rewards = usdc_data.get("rewards", 0)
        rewards_eur = usdc_data.get("rewards_eur", 0)
        
        print(f"  USDC Deposits: {deposits:.2f} tokens = €{deposits_eur:.2f}")
        print(f"  USDC Rewards: {rewards:.2f} tokens = €{rewards_eur:.2f}")
        
        # USDC is a stablecoin, so 1 USDC ≈ 0.92 EUR
        # Values should be close but not exactly equal due to exchange rate
        if deposits > 0:
            ratio = deposits_eur / deposits
            assert 0.8 < ratio < 1.2, f"USDC deposit EUR ratio should be ~0.92, got {ratio}"
            print(f"✓ USDC deposit EUR ratio: {ratio:.3f} (expected ~0.92)")
        
        if rewards > 0:
            ratio = rewards_eur / rewards
            assert 0.8 < ratio < 1.2, f"USDC rewards EUR ratio should be ~0.92, got {ratio}"
            print(f"✓ USDC rewards EUR ratio: {ratio:.3f} (expected ~0.92)")
    
    def test_total_rewards_eur_calculation(self):
        """Test that total_rewards_eur is correctly summed for all assets"""
        response = self.session.get(f"{BASE_URL}/api/defi/positions")
        assert response.status_code == 200
        
        data = response.json()
        positions = data.get("positions", {})
        
        assert "8LENDS" in positions
        lends = positions["8LENDS"]
        
        # Calculate expected total rewards EUR from assets
        expected_total = 0
        for asset, asset_data in lends.get("assets", {}).items():
            expected_total += asset_data.get("rewards_eur", 0)
            print(f"  {asset} rewards_eur: €{asset_data.get('rewards_eur', 0):.2f}")
        
        actual_total = lends.get("total_rewards_eur", 0)
        
        print(f"  Calculated total rewards EUR: €{expected_total:.2f}")
        print(f"  API total_rewards_eur: €{actual_total:.2f}")
        
        # Allow small floating point differences
        assert abs(expected_total - actual_total) < 1, \
            f"Total rewards mismatch: expected €{expected_total:.2f}, got €{actual_total:.2f}"
        
        print(f"✓ Total rewards EUR correctly calculated: €{actual_total:.2f}")
    
    def test_french_number_format_compatibility(self):
        """Test that values can be formatted in French number format"""
        response = self.session.get(f"{BASE_URL}/api/defi/positions")
        assert response.status_code == 200
        
        data = response.json()
        positions = data.get("positions", {})
        
        if "8LENDS" in positions:
            lends = positions["8LENDS"]
            assets = lends.get("assets", {})
            
            # Simulate French formatting (uses comma for decimal, space for thousands)
            if "8LNDS" in assets:
                eur_value = assets["8LNDS"].get("rewards_eur", 0)
                # Format like: 18,45 € (French format)
                french_format = f"{eur_value:,.2f}".replace(",", " ").replace(".", ",")
                print(f"  8LNDS EUR in French format: {french_format} €")
                
                # The frontend uses toLocaleString('fr-FR'), verify the value is numeric
                assert isinstance(eur_value, (int, float)), "EUR value should be numeric"
                print(f"✓ EUR value is numeric and can be formatted")


class TestDeFiPositionDetail:
    """Tests for the /api/defi/position/{protocol} endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test by logging in"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "fiatdemo",
            "password": "FiatDemo123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_8lends_detail_endpoint(self):
        """Test the detailed view for 8LENDS protocol"""
        response = self.session.get(f"{BASE_URL}/api/defi/position/8LENDS")
        
        # May return 404 if no transactions found
        if response.status_code == 404:
            pytest.skip("No 8LENDS transactions found for detail view")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "summary" in data, "Response should contain 'summary'"
        assert "transactions" in data, "Response should contain 'transactions'"
        
        summary = data["summary"]
        print(f"  Protocol: {summary.get('name')}")
        print(f"  Total Deposits EUR: €{summary.get('total_deposits_eur', 0):.2f}")
        print(f"  Total Rewards EUR: €{summary.get('total_rewards_eur', 0):.2f}")
        print(f"  Transaction count: {len(data.get('transactions', []))}")
        
        print(f"✓ 8LENDS detail endpoint working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
