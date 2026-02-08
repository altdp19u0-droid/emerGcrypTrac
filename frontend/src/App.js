import React, { useState, useEffect, useCallback, createContext, useContext } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, NavLink, useLocation, Navigate, useNavigate } from "react-router-dom";
import axios from "axios";
import { 
  LayoutDashboard, Wallet, DollarSign, ArrowLeftRight, FileText, Download, 
  Plus, RefreshCw, Trash2, Copy, ChevronLeft, ChevronRight, Upload, LogOut,
  TrendingUp, TrendingDown, User, Lock, Mail, Calculator, Ban, Check,
  Shield, AlertTriangle, Circle, PanelLeftClose, PanelLeft, Edit2, PiggyBank, Clock, Settings, Eye, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from "recharts";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// ==================== SIDEBAR CONTEXT ====================

const SidebarContext = createContext(null);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within SidebarProvider");
  }
  return context;
};

const SidebarProvider = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    return saved === "true";
  });

  const toggleSidebar = () => {
    setIsCollapsed(prev => {
      const newValue = !prev;
      localStorage.setItem("sidebarCollapsed", newValue.toString());
      return newValue;
    });
  };

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggleSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
};

// ==================== AUTH CONTEXT ====================

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(localStorage.getItem("accessToken"));
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem("refreshToken"));
  const [loading, setLoading] = useState(true);

  const login = (tokens) => {
    setAccessToken(tokens.access_token);
    setRefreshToken(tokens.refresh_token);
    localStorage.setItem("accessToken", tokens.access_token);
    localStorage.setItem("refreshToken", tokens.refresh_token);
  };

  const logout = async () => {
    // Clear Etherscan API key on server
    if (accessToken) {
      try {
        await axios.delete(`${API}/etherscan/clear-api-key`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
      } catch (e) {
        // Ignore errors during logout
      }
    }
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  };

  const fetchUser = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      setUser(response.data);
    } catch (error) {
      if (error.response?.status === 401 && refreshToken) {
        try {
          const refreshResponse = await axios.post(`${API}/auth/refresh`, {
            refresh_token: refreshToken
          });
          login(refreshResponse.data);
          const userResponse = await axios.get(`${API}/auth/me`, {
            headers: { Authorization: `Bearer ${refreshResponse.data.access_token}` }
          });
          setUser(userResponse.data);
        } catch {
          logout();
        }
      } else {
        logout();
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, refreshToken]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return (
    <AuthContext.Provider value={{ user, accessToken, login, logout, loading, isAuthenticated: !!accessToken }}>
      {children}
    </AuthContext.Provider>
  );
};

// ==================== AXIOS INTERCEPTOR ====================

const createAuthenticatedApi = (accessToken) => {
  const instance = axios.create({
    baseURL: API,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
  });
  return instance;
};

// ==================== PROTECTED ROUTE ====================

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="loading-screen">
        <RefreshCw className="animate-spin" size={32} />
        <p>Loading...</p>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// ==================== LOGIN PAGE ====================

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    full_name: ""
  });

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const response = await axios.post(`${API}/auth/login`, {
          username: formData.username,
          password: formData.password
        });
        login(response.data);
        toast.success("Connexion réussie !");
        navigate("/");
      } else {
        if (formData.password !== formData.confirmPassword) {
          toast.error("Les mots de passe ne correspondent pas");
          setLoading(false);
          return;
        }
        const response = await axios.post(`${API}/auth/register`, {
          email: formData.email,
          username: formData.username,
          password: formData.password,
          full_name: formData.full_name || null
        });
        login(response.data);
        toast.success("Compte créé avec succès !");
        navigate("/");
      }
    } catch (error) {
      const message = error.response?.data?.detail || "Une erreur est survenue";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" data-testid="login-page">
      <Card className="auth-card">
        <CardHeader className="text-center">
          <div className="auth-logo">
            <TrendingUp size={32} />
          </div>
          <CardTitle className="text-2xl">CryptoTrack</CardTitle>
          <CardDescription>
            {isLogin ? "Connectez-vous à votre compte" : "Créez votre compte"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="email@example.com"
                    required
                    data-testid="email-input"
                  />
                </div>
                <div>
                  <Label>Nom complet (optionnel)</Label>
                  <Input
                    value={formData.full_name}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    placeholder="Jean Dupont"
                    data-testid="fullname-input"
                  />
                </div>
              </>
            )}
            <div>
              <Label>{isLogin ? "Username ou Email" : "Username"}</Label>
              <Input
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
                placeholder="username"
                required
                data-testid="username-input"
              />
            </div>
            <div>
              <Label>Mot de passe</Label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                placeholder="••••••••"
                required
                data-testid="password-input"
              />
              {!isLogin && (
                <p className="text-xs text-muted-foreground mt-1">
                  Min 8 caractères, 1 majuscule, 1 chiffre
                </p>
              )}
            </div>
            {!isLogin && (
              <div>
                <Label>Confirmer le mot de passe</Label>
                <Input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  placeholder="••••••••"
                  required
                  data-testid="confirm-password-input"
                />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading} data-testid="submit-btn">
              {loading ? <RefreshCw className="animate-spin mr-2" size={16} /> : null}
              {isLogin ? "Se connecter" : "Créer un compte"}
            </Button>
          </form>
          
          <div className="auth-switch mt-4 text-center">
            <Button variant="link" onClick={() => setIsLogin(!isLogin)} data-testid="switch-auth-mode">
              {isLogin ? "Pas de compte ? Inscrivez-vous" : "Déjà un compte ? Connectez-vous"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ==================== SIDEBAR ====================

const Sidebar = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { isCollapsed, toggleSidebar } = useSidebar();
  
  const navItems = [
    { path: "/", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/wallets", icon: Wallet, label: "Wallets" },
    { path: "/fiat", icon: DollarSign, label: "Fiat" },
    { path: "/positions", icon: PiggyBank, label: "Positions" },
    { path: "/transactions", icon: ArrowLeftRight, label: "Transactions" },
    { path: "/pnl", icon: Calculator, label: "P&L" },
    { path: "/reports", icon: FileText, label: "Rapports" },
    { path: "/export", icon: Download, label: "Export" },
  ];

  return (
    <div className={`sidebar ${isCollapsed ? 'sidebar-collapsed' : ''}`} data-testid="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">
          <TrendingUp size={24} />
        </div>
        {!isCollapsed && (
          <div className="logo-text">
            <span className="logo-title">CryptoTrack</span>
            <span className="logo-subtitle">Portfolio Tracker</span>
          </div>
        )}
      </div>
      
      <button 
        className="sidebar-toggle" 
        onClick={toggleSidebar}
        title={isCollapsed ? "Déployer le menu" : "Réduire le menu"}
      >
        {isCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
      </button>
      
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
            data-testid={`nav-${item.label.toLowerCase()}`}
            title={isCollapsed ? item.label : undefined}
          >
            <item.icon size={20} />
            {!isCollapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>
      
      <div className="sidebar-footer">
        {!isCollapsed && (
          <div className="user-info">
            <User size={16} />
            <span className="user-name">{user?.username || "User"}</span>
          </div>
        )}
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={logout} 
          className={`logout-btn ${isCollapsed ? 'logout-btn-collapsed' : ''}`}
          data-testid="logout-btn"
          title={isCollapsed ? "Déconnexion" : undefined}
        >
          <LogOut size={16} />
          {!isCollapsed && "Déconnexion"}
        </Button>
      </div>
    </div>
  );
};

// ==================== DASHBOARD ====================

const Dashboard = () => {
  const { accessToken } = useAuth();
  const [portfolio, setPortfolio] = useState({ total_value_usd: 0, assets: [] });
  const [prices, setPrices] = useState({});
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState("USDC");
  const [hiddenTokens, setHiddenTokens] = useState([]);
  const [newHiddenToken, setNewHiddenToken] = useState("");
  const [hiddenTokensDialogOpen, setHiddenTokensDialogOpen] = useState(false);

  const api = createAuthenticatedApi(accessToken);

  const fetchHiddenTokens = useCallback(async () => {
    try {
      const response = await api.get("/hidden-tokens");
      setHiddenTokens(response.data.symbols || []);
    } catch (error) {
      console.error("Error fetching hidden tokens:", error);
    }
  }, [api]);

  const fetchData = useCallback(async () => {
    try {
      const [portfolioRes, pricesRes, historyRes] = await Promise.all([
        api.get("/portfolio/summary"),
        api.get("/crypto/prices"),
        api.get(`/crypto/historical/${selectedAsset}?days=30`)
      ]);
      
      setPortfolio(portfolioRes.data);
      setPrices(pricesRes.data);
      
      if (historyRes.data.prices) {
        const formattedData = historyRes.data.prices.map(([timestamp, price]) => ({
          date: new Date(timestamp).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
          price: price
        }));
        setChartData(formattedData);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  }, [selectedAsset, api]);

  useEffect(() => {
    fetchData();
    fetchHiddenTokens();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData, fetchHiddenTokens]);

  const handleAddHiddenToken = async () => {
    if (!newHiddenToken.trim()) return;
    try {
      await api.post("/hidden-tokens", { symbol: newHiddenToken.trim() });
      toast.success(`Token ${newHiddenToken.toUpperCase()} masqué`);
      setNewHiddenToken("");
      fetchHiddenTokens();
    } catch (error) {
      toast.error("Erreur lors de l'ajout");
    }
  };

  const handleRemoveHiddenToken = async (symbol) => {
    try {
      await api.delete(`/hidden-tokens/${symbol}`);
      toast.success(`Token ${symbol} restauré`);
      fetchHiddenTokens();
    } catch (error) {
      toast.error("Erreur lors de la suppression");
    }
  };

  const COLORS = ["#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6"];

  // Filter out spam tokens - only show assets with value > 0, percentage > 0.1%, and not in hidden list
  const filteredAssets = portfolio.assets.filter(asset => {
    const percentage = portfolio.total_value_usd > 0 
      ? (asset.value_usd / portfolio.total_value_usd) * 100 
      : 0;
    // Exclude assets with 0 value, very small percentage (spam tokens), or in hidden list
    const isHidden = hiddenTokens.includes(asset.asset.toUpperCase());
    return asset.value_usd > 0 && percentage >= 0.1 && !isHidden;
  });

  const allocationData = filteredAssets.map((asset, index) => ({
    name: asset.asset,
    value: asset.value_usd,
    percentage: portfolio.total_value_usd > 0 
      ? ((asset.value_usd / portfolio.total_value_usd) * 100).toFixed(2) 
      : 0,
    color: COLORS[index % COLORS.length]
  }));

  return (
    <div className="page-content" data-testid="dashboard-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Portfolio Dashboard</h1>
          <p className="page-subtitle">Track your stablecoin holdings</p>
        </div>
        <div className="header-actions">
          <Dialog open={hiddenTokensDialogOpen} onOpenChange={setHiddenTokensDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="manage-hidden-tokens-btn">
                <Ban size={16} className="mr-2" />
                Tokens masqués ({hiddenTokens.length})
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Gérer les tokens masqués</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Les tokens ajoutés ici ne s'afficheront plus dans votre portfolio.
                </p>
                <div className="flex gap-2">
                  <Input 
                    value={newHiddenToken}
                    onChange={(e) => setNewHiddenToken(e.target.value)}
                    placeholder="Symbole du token (ex: SHIT)"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddHiddenToken()}
                    data-testid="hidden-token-input"
                  />
                  <Button onClick={handleAddHiddenToken} data-testid="add-hidden-token-btn">
                    <Plus size={16} />
                  </Button>
                </div>
                {hiddenTokens.length > 0 ? (
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                      {hiddenTokens.map((symbol) => (
                        <div key={symbol} className="flex items-center justify-between p-2 bg-zinc-800 rounded-md">
                          <span className="font-mono text-sm">{symbol}</span>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleRemoveHiddenToken(symbol)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            data-testid={`remove-hidden-${symbol}`}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-center text-muted-foreground py-4">Aucun token masqué</p>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Button onClick={fetchData} variant="outline" data-testid="refresh-btn">
            <RefreshCw size={16} className="mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="dashboard-grid">
        <Card className="value-card" data-testid="total-value-card">
          <CardContent className="pt-6">
            <div className="value-header">
              <span className="value-label">Total Portfolio Value</span>
              <div className="value-icon">
                <DollarSign size={20} />
              </div>
            </div>
            <div className="value-amount">${portfolio.total_value_usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="value-detail">{filteredAssets.length || 0} assets (spam filtrés)</div>
          </CardContent>
        </Card>

        <Card className="allocation-card" data-testid="allocation-card">
          <CardHeader>
            <CardTitle className="card-title-sm">Asset Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="allocation-content">
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={allocationData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2}>
                    {allocationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="allocation-legend">
                {allocationData.map((item, index) => (
                  <div key={index} className="legend-item">
                    <span className="legend-dot" style={{ backgroundColor: item.color }} />
                    <span className="legend-label">{item.name}</span>
                    <span className="legend-value">{item.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="assets-card" data-testid="assets-tracked-card">
          <CardContent className="pt-6">
            <div className="assets-header">
              <span className="assets-label">Assets Tracked</span>
              <span className="assets-count">{portfolio.asset_count || 0}</span>
            </div>
            <div className="assets-badges">
              {["USDC", "EURC", "AGEUR", "ZCHF"].map((asset) => (
                <Badge key={asset} variant={portfolio.assets?.some(a => a.asset === asset) ? "default" : "secondary"}>
                  {asset}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="chart-card" data-testid="price-chart-card">
        <CardHeader>
          <div className="chart-header">
            <CardTitle className="card-title-sm">
              <TrendingUp size={16} className="mr-2" />
              {selectedAsset} Price (30 Days)
            </CardTitle>
            <Select value={selectedAsset} onValueChange={setSelectedAsset}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["USDC", "EURC", "AGEUR", "ZCHF"].map((asset) => (
                  <SelectItem key={asset} value={asset}>{asset}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: '#6B7280', fontSize: 12 }} />
              <YAxis domain={['auto', 'auto']} tick={{ fill: '#6B7280', fontSize: 12 }} />
              <RechartsTooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} />
              <Area type="monotone" dataKey="price" stroke="#3B82F6" fillOpacity={1} fill="url(#colorPrice)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="prices-card" data-testid="live-prices-card">
        <CardHeader>
          <CardTitle className="card-title-sm">Live Prices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prices-grid">
            {Object.entries(prices).map(([symbol, data]) => (
              <div key={symbol} className="price-item" data-testid={`price-${symbol.toLowerCase()}`}>
                <div className="price-header">
                  <span className="price-symbol">{symbol}</span>
                  <span className={`price-indicator ${data.change_24h >= 0 ? 'positive' : 'negative'}`} />
                </div>
                <div className="price-value">${data.price_usd?.toFixed(4)}</div>
                <div className={`price-change ${data.change_24h >= 0 ? 'positive' : 'negative'}`}>
                  {data.change_24h >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {Math.abs(data.change_24h || 0).toFixed(2)}%
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ==================== WALLETS PAGE ====================

const WalletsPage = () => {
  const { accessToken } = useAuth();
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [walletType, setWalletType] = useState("address");
  const [newWallet, setNewWallet] = useState({ name: "", address: "", network: "Ethereum" });
  const [syncing, setSyncing] = useState(null);
  const [pendingSyncWalletId, setPendingSyncWalletId] = useState(null);
  const [etherscanApiKey, setEtherscanApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [verifyingWallet, setVerifyingWallet] = useState(null);
  const [missingTransactions, setMissingTransactions] = useState([]);
  const [selectedMissingTx, setSelectedMissingTx] = useState([]);
  const [importingMissing, setImportingMissing] = useState(false);

  const api = createAuthenticatedApi(accessToken);

  const fetchWallets = async () => {
    try {
      const response = await api.get("/wallets");
      setWallets(response.data);
    } catch (error) {
      toast.error("Erreur lors du chargement des wallets");
    } finally {
      setLoading(false);
    }
  };

  const checkApiKey = async () => {
    try {
      const response = await api.get("/etherscan/has-api-key");
      setHasApiKey(response.data.has_api_key);
    } catch (error) {
      setHasApiKey(false);
    }
  };

  useEffect(() => {
    fetchWallets();
    checkApiKey();
  }, []);

  const handleCreateWallet = async () => {
    try {
      await api.post("/wallets", {
        ...newWallet,
        type: walletType,
        address: walletType === "manual" ? `manual_${Date.now()}` : newWallet.address
      });
      toast.success("Wallet créé avec succès");
      setDialogOpen(false);
      setNewWallet({ name: "", address: "", network: "Ethereum" });
      fetchWallets();
    } catch (error) {
      toast.error("Erreur lors de la création du wallet");
    }
  };

  const handleDeleteWallet = async (id) => {
    if (window.confirm("Supprimer ce wallet et toutes ses transactions ?")) {
      try {
        await api.delete(`/wallets/${id}`);
        toast.success("Wallet supprimé");
        fetchWallets();
      } catch (error) {
        toast.error("Erreur lors de la suppression");
      }
    }
  };

  const handleDeleteAllWallets = async () => {
    if (window.confirm("Supprimer TOUS les wallets et leurs transactions ?")) {
      try {
        await api.delete("/wallets");
        toast.success("Tous les wallets ont été supprimés");
        fetchWallets();
      } catch (error) {
        toast.error("Erreur lors de la suppression");
      }
    }
  };

  const handleVerifyTransactions = async (wallet) => {
    setVerifyingWallet(wallet);
    setMissingTransactions([]);
    setSelectedMissingTx([]);
    setVerifyDialogOpen(true);
    
    try {
      toast.info("Vérification en cours...");
      const response = await api.get(`/wallets/${wallet.id}/verify-transactions`);
      
      if (!response.data.supported) {
        toast.warning(response.data.message);
        setVerifyDialogOpen(false);
        return;
      }
      
      setMissingTransactions(response.data.missing_transactions || []);
      
      if (response.data.missing_count === 0) {
        toast.success("Aucune transaction manquante !");
      } else {
        toast.info(`${response.data.missing_count} transaction(s) manquante(s) détectée(s)`);
      }
    } catch (error) {
      toast.error("Erreur lors de la vérification");
      setVerifyDialogOpen(false);
    }
  };

  const handleImportSelectedMissing = async () => {
    if (selectedMissingTx.length === 0) {
      toast.warning("Sélectionnez au moins une transaction à importer");
      return;
    }
    
    setImportingMissing(true);
    try {
      const response = await api.post(`/wallets/${verifyingWallet.id}/import-missing`, selectedMissingTx);
      toast.success(response.data.message);
      
      // Re-verify to update the list
      const verifyResponse = await api.get(`/wallets/${verifyingWallet.id}/verify-transactions`);
      setMissingTransactions(verifyResponse.data.missing_transactions || []);
      setSelectedMissingTx([]);
      
      if (response.data.errors && response.data.errors.length > 0) {
        console.warn("Import errors:", response.data.errors);
      }
    } catch (error) {
      toast.error("Erreur lors de l'import");
    } finally {
      setImportingMissing(false);
    }
  };

  const toggleSelectMissingTx = (txHash) => {
    setSelectedMissingTx(prev => 
      prev.includes(txHash) 
        ? prev.filter(h => h !== txHash)
        : [...prev, txHash]
    );
  };

  const selectAllMissingTx = () => {
    if (selectedMissingTx.length === missingTransactions.length) {
      setSelectedMissingTx([]);
    } else {
      setSelectedMissingTx(missingTransactions.map(tx => tx.tx_hash));
    }
  };

  const syncFromBlockchain = async (walletId, apiKey = null) => {
    setSyncing(walletId);
    try {
      const payload = apiKey ? { api_key: apiKey } : {};
      const response = await api.post(`/etherscan/sync/${walletId}`, payload);
      toast.success(response.data.message);
      setHasApiKey(true);
      fetchWallets();
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (detail === "API_KEY_REQUIRED") {
        // Open API key dialog
        setPendingSyncWalletId(walletId);
        setApiKeyDialogOpen(true);
      } else if (error.response?.status === 401) {
        toast.error("Clé API Etherscan invalide");
        setHasApiKey(false);
      } else {
        toast.error(detail || "Sync failed");
      }
    } finally {
      setSyncing(null);
    }
  };

  const syncAllWallets = async (apiKey = null) => {
    setSyncing("all");
    try {
      const payload = apiKey ? { api_key: apiKey } : {};
      const response = await api.post("/etherscan/sync-all", payload);
      toast.success(response.data.message);
      setHasApiKey(true);
      fetchWallets();
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (detail === "API_KEY_REQUIRED") {
        setPendingSyncWalletId("all");
        setApiKeyDialogOpen(true);
      } else if (error.response?.status === 401) {
        toast.error("Clé API Etherscan invalide");
        setHasApiKey(false);
      } else {
        toast.error(detail || "Sync failed");
      }
    } finally {
      setSyncing(null);
    }
  };

  const syncWalletOnChain = async (walletId, address, chain, apiKey = null) => {
    setSyncing(`${walletId}-${chain}`);
    try {
      const payload = apiKey ? { api_key: apiKey, address, chain } : { address, chain };
      const response = await api.post(`/etherscan/sync-chain`, payload);
      toast.success(response.data.message);
      setHasApiKey(true);
      fetchWallets();
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (detail === "API_KEY_REQUIRED") {
        setPendingSyncWalletId(`chain-${walletId}-${address}-${chain}`);
        setApiKeyDialogOpen(true);
      } else if (error.response?.status === 401) {
        toast.error("Clé API Etherscan invalide");
        setHasApiKey(false);
      } else {
        toast.error(detail || "Sync failed");
      }
    } finally {
      setSyncing(null);
    }
  };

  const handleApiKeySubmit = async () => {
    if (!etherscanApiKey.trim()) {
      toast.error("Veuillez entrer une clé API");
      return;
    }
    setApiKeyDialogOpen(false);
    if (pendingSyncWalletId === "all") {
      await syncAllWallets(etherscanApiKey);
    } else if (pendingSyncWalletId?.startsWith("chain-")) {
      // Parse: chain-walletId-address-chainName
      const parts = pendingSyncWalletId.split("-");
      const walletId = parts[1];
      const address = parts[2];
      const chain = parts[3];
      await syncWalletOnChain(walletId, address, chain, etherscanApiKey);
    } else if (pendingSyncWalletId) {
      await syncFromBlockchain(pendingSyncWalletId, etherscanApiKey);
    }
    setPendingSyncWalletId(null);
    setEtherscanApiKey("");
  };

  const copyAddress = (address) => {
    navigator.clipboard.writeText(address);
    toast.success("Adresse copiée");
  };

  return (
    <div className="page-content" data-testid="wallets-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Wallets</h1>
          <p className="page-subtitle">Manage your wallet addresses</p>
        </div>
        <div className="header-actions">
          <Button 
            variant="outline" 
            onClick={() => syncAllWallets()} 
            disabled={syncing === "all" || wallets.length === 0}
            data-testid="sync-all-btn"
          >
            <RefreshCw size={16} className={syncing === "all" ? "animate-spin mr-2" : "mr-2"} />
            {syncing === "all" ? "Syncing..." : "Sync All"}
          </Button>
          <Button variant="outline" onClick={handleDeleteAllWallets} data-testid="delete-all-wallets-btn">
            <Trash2 size={16} className="mr-2" />
            Delete All
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="add-wallet-btn">
                <Plus size={16} className="mr-2" />
                Add Wallet
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Wallet</DialogTitle>
              </DialogHeader>
              <div className="dialog-form">
                <Tabs value={walletType} onValueChange={setWalletType}>
                  <TabsList className="w-full bg-zinc-800">
                    <TabsTrigger value="address" className="flex-1 data-[state=active]:bg-zinc-700 data-[state=active]:text-white text-zinc-300">Wallet Address</TabsTrigger>
                    <TabsTrigger value="manual" className="flex-1 data-[state=active]:bg-zinc-700 data-[state=active]:text-white text-zinc-300">Manual</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="address" className="space-y-4 mt-4">
                    <div>
                      <Label>Wallet Name</Label>
                      <Input 
                        value={newWallet.name}
                        onChange={(e) => setNewWallet({...newWallet, name: e.target.value})}
                        placeholder="My Wallet"
                        data-testid="wallet-name-input"
                      />
                    </div>
                    <div>
                      <Label>Address</Label>
                      <Input 
                        value={newWallet.address}
                        onChange={(e) => setNewWallet({...newWallet, address: e.target.value})}
                        placeholder="0x..."
                        data-testid="wallet-address-input"
                      />
                    </div>
                    <div>
                      <Label>Network</Label>
                      <Select value={newWallet.network} onValueChange={(v) => setNewWallet({...newWallet, network: v})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Ethereum">Ethereum (ETH)</SelectItem>
                          <SelectItem value="Polygon">Polygon (MATIC)</SelectItem>
                          <SelectItem value="Arbitrum">Arbitrum (ARB)</SelectItem>
                          <SelectItem value="Base">Base</SelectItem>
                          <SelectItem value="Optimism">Optimism (OP)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        La même clé API Etherscan fonctionne sur tous les réseaux
                      </p>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="manual" className="space-y-4 mt-4">
                    <div>
                      <Label>Wallet Name</Label>
                      <Input 
                        value={newWallet.name}
                        onChange={(e) => setNewWallet({...newWallet, name: e.target.value})}
                        placeholder="Manual Wallet"
                        data-testid="manual-wallet-name-input"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Manual wallets allow you to add transactions without blockchain sync.
                    </p>
                  </TabsContent>
                </Tabs>
                
                <Button onClick={handleCreateWallet} className="w-full mt-4" data-testid="create-wallet-btn">
                  Create Wallet
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          {/* Etherscan API Key Dialog */}
          <Dialog open={apiKeyDialogOpen} onOpenChange={setApiKeyDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Clé API Scanner Requise</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Pour synchroniser les transactions blockchain, vous devez entrer votre clé API Etherscan.
                  <strong> Une seule clé fonctionne sur tous les réseaux</strong> (Ethereum, Polygon, Arbitrum, Base, Optimism).
                </p>
                <div>
                  <Label>Clé API Etherscan</Label>
                  <Input 
                    type="password"
                    value={etherscanApiKey}
                    onChange={(e) => setEtherscanApiKey(e.target.value)}
                    placeholder="Votre clé API..."
                    data-testid="etherscan-api-key-input"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Obtenez une clé gratuite sur <a href="https://etherscan.io/myapikey" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">etherscan.io/myapikey</a>
                </p>
                <Button onClick={handleApiKeySubmit} className="w-full" data-testid="submit-api-key-btn">
                  Synchroniser
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="wallets-grid">
        {wallets.map((wallet) => (
          <Card key={wallet.id} className="wallet-card" data-testid={`wallet-${wallet.id}`}>
            <CardContent className="pt-6">
              <div className="wallet-header">
                <div className={`wallet-icon wallet-icon-${wallet.network?.toLowerCase() || 'ethereum'}`}>
                  <Wallet size={24} />
                </div>
                <div className="wallet-info">
                  <h3 className="wallet-name">{wallet.name}</h3>
                  <span className="wallet-network">{wallet.network || "Ethereum"}</span>
                </div>
                {/* Action buttons in header */}
                <div className="flex gap-2 ml-auto">
                  {wallet.type !== "manual" && (
                    <>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleVerifyTransactions(wallet)}
                        className="text-amber-400 hover:text-amber-500 hover:bg-amber-500/10"
                        title="Vérifier les transactions manquantes"
                        data-testid={`verify-wallet-${wallet.id}`}
                      >
                        <Eye size={18} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => syncFromBlockchain(wallet.id)}
                        disabled={syncing === wallet.id}
                        className="text-blue-400 hover:text-blue-500 hover:bg-blue-500/10"
                        title="Synchroniser"
                      >
                        <RefreshCw size={18} className={syncing === wallet.id ? "animate-spin" : ""} />
                      </Button>
                    </>
                  )}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleDeleteWallet(wallet.id)}
                    className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                    data-testid={`delete-wallet-${wallet.id}`}
                    title="Supprimer"
                  >
                    <Trash2 size={18} />
                  </Button>
                </div>
              </div>
              
              <div className="wallet-address-row">
                <span className="wallet-address-label">Address</span>
                <div className="wallet-address-value">
                  <span>{wallet.address.substring(0, 20)}...</span>
                  <button onClick={() => copyAddress(wallet.address)} className="copy-btn">
                    <Copy size={14} />
                  </button>
                </div>
              </div>
              
              {/* Sync all chains buttons */}
              {wallet.type !== "manual" && (
                <div className="wallet-chains-info">
                  <span className="wallet-chains-label">Synchroniser sur les chaînes</span>
                  <div className="wallet-chains-list">
                    {[
                      { name: "Ethereum", short: "ETH", info: "Etherscan" },
                      { name: "Polygon", short: "MATIC", info: "Etherscan" },
                      { name: "Arbitrum", short: "ARB", info: "Etherscan" },
                      { name: "Base", short: "BASE", info: "Blockscout (gratuit)" },
                      { name: "Optimism", short: "OP", info: "Blockscout (gratuit)" }
                    ].map(chain => (
                      <Button 
                        key={chain.name}
                        variant="outline" 
                        size="sm"
                        className={`chain-badge chain-${chain.name.toLowerCase()} text-xs cursor-pointer ${syncing === `${wallet.id}-${chain.name}` ? 'animate-pulse' : ''}`}
                        onClick={() => syncWalletOnChain(wallet.id, wallet.address, chain.name)}
                        disabled={syncing !== null}
                        title={`Sync via ${chain.info}`}
                      >
                        {syncing === `${wallet.id}-${chain.name}` ? <RefreshCw size={12} className="animate-spin mr-1" /> : null}
                        {chain.short}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Base & Optimism utilisent Blockscout (gratuit, sans clé API)</p>
                </div>
              )}
              
              <div className="wallet-badges">
                <Badge variant={wallet.type === "manual" ? "secondary" : "outline"}>
                  {wallet.type === "manual" ? "Manual" : "Blockchain"}
                </Badge>
                <Badge variant="outline" className={`chain-badge chain-${wallet.network?.toLowerCase() || 'ethereum'}`}>
                  {wallet.network || "Ethereum"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {wallets.length === 0 && (
          <div className="empty-state">
            <Wallet size={48} className="empty-icon" />
            <h3>No wallets yet</h3>
            <p>Add your first wallet to start tracking on Ethereum, Polygon, Arbitrum, Base or Optimism</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== TRANSACTIONS PAGE ====================

const TransactionsPage = () => {
  const { accessToken } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [fiatAccounts, setFiatAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1, pageSize: 50 });
  const [filters, setFilters] = useState({ 
    wallet_ids: [], // Multi-select for wallets
    assets: [], // Multi-select for assets  
    tx_types: [], // Multi-select for types
    start_date: "", 
    end_date: "",
    hide_spam: true, // Hide spam by default
    include_fiat: false, // Fiat transactions excluded by default
    fiat_account_ids: [] // Multi-select for fiat accounts
  });
  const [addressClassifications, setAddressClassifications] = useState({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [editCryptoDialogOpen, setEditCryptoDialogOpen] = useState(false);
  const [editingCryptoTx, setEditingCryptoTx] = useState(null);
  const [csvData, setCsvData] = useState("");
  const [selectedWalletForImport, setSelectedWalletForImport] = useState("");
  const [newTransaction, setNewTransaction] = useState({
    type: "Buy", asset: "USDC", amount: 0, price_usd: 1, price_eur: 0.92,
    value_usd: 0, value_eur: 0, fees: 0, fees_currency: "EUR", wallet_id: "", wallet_name: "",
    source: "manual", 
    date: new Date().toISOString().split("T")[0], 
    time: new Date().toTimeString().slice(0, 5),
    counterparty_wallet: "",
    target_wallet_id: "none",
    create_counterpart_tx: false
  });
  
  // Address comparison state
  const [compareAddress1, setCompareAddress1] = useState("");
  const [compareAddress2, setCompareAddress2] = useState("");
  
  // Available assets from transactions
  const [availableAssets, setAvailableAssets] = useState(["USDC", "EURC", "ETH", "MATIC", "EUR", "USD", "CHF"]);

  const api = createAuthenticatedApi(accessToken);

  // Helper function to get blockchain explorer URL for an address
  const getExplorerAddressUrl = (address, walletName) => {
    if (!address) return null;
    
    // Determine network from wallet name or default to Ethereum
    const nameLower = (walletName || "").toLowerCase();
    
    if (nameLower.includes("base")) {
      return `https://basescan.org/address/${address}`;
    } else if (nameLower.includes("polygon") || nameLower.includes("matic")) {
      return `https://polygonscan.com/address/${address}`;
    } else if (nameLower.includes("bsc") || nameLower.includes("binance")) {
      return `https://bscscan.com/address/${address}`;
    } else if (nameLower.includes("arbitrum")) {
      return `https://arbiscan.io/address/${address}`;
    } else if (nameLower.includes("optimism")) {
      return `https://optimistic.etherscan.io/address/${address}`;
    } else if (nameLower.includes("gnosis") || nameLower.includes("xdai")) {
      return `https://gnosisscan.io/address/${address}`;
    } else {
      // Default to Ethereum
      return `https://etherscan.io/address/${address}`;
    }
  };

  // Helper function to get blockchain explorer URL for a transaction hash
  const getExplorerTxUrl = (txHash, walletName) => {
    if (!txHash) return null;
    
    const nameLower = (walletName || "").toLowerCase();
    
    if (nameLower.includes("base")) {
      return `https://basescan.org/tx/${txHash}`;
    } else if (nameLower.includes("polygon") || nameLower.includes("matic")) {
      return `https://polygonscan.com/tx/${txHash}`;
    } else if (nameLower.includes("bsc") || nameLower.includes("binance")) {
      return `https://bscscan.com/tx/${txHash}`;
    } else if (nameLower.includes("arbitrum")) {
      return `https://arbiscan.io/tx/${txHash}`;
    } else if (nameLower.includes("optimism")) {
      return `https://optimistic.etherscan.io/tx/${txHash}`;
    } else if (nameLower.includes("gnosis") || nameLower.includes("xdai")) {
      return `https://gnosisscan.io/tx/${txHash}`;
    } else {
      return `https://etherscan.io/tx/${txHash}`;
    }
  };

  const fetchTransactions = useCallback(async () => {
    try {
      const params = {
        page: pagination.page,
        page_size: pagination.pageSize,
        ...(filters.wallet_ids.length > 0 && { wallet_ids: filters.wallet_ids.join(",") }),
        ...(filters.assets.length > 0 && { assets: filters.assets.join(",") }),
        ...(filters.tx_types.length > 0 && { tx_types: filters.tx_types.join(",") }),
        ...(filters.start_date && { start_date: filters.start_date }),
        ...(filters.end_date && { end_date: filters.end_date }),
        hide_spam: filters.hide_spam,
        include_fiat: filters.include_fiat,
        ...(filters.fiat_account_ids.length > 0 && { fiat_account_ids: filters.fiat_account_ids.join(",") })
      };
      
      const response = await api.get("/transactions", { params });
      setTransactions(response.data.transactions);
      setPagination(prev => ({
        ...prev,
        total: response.data.total,
        totalPages: response.data.total_pages
      }));
      
      // Update available assets from transactions
      const assets = [...new Set(response.data.transactions.map(tx => tx.asset))];
      if (assets.length > 0) {
        setAvailableAssets(prev => [...new Set([...prev, ...assets])]);
      }
    } catch (error) {
      toast.error("Erreur lors du chargement des transactions");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, filters, api]);

  const fetchWallets = async () => {
    try {
      const response = await api.get("/wallets");
      setWallets(response.data);
    } catch (error) {
      console.error("Error fetching wallets:", error);
    }
  };

  const fetchFiatAccounts = async () => {
    try {
      const response = await api.get("/fiat-accounts");
      setFiatAccounts(response.data);
    } catch (error) {
      console.error("Error fetching fiat accounts:", error);
    }
  };

  const fetchAddressClassifications = async () => {
    try {
      const response = await api.get("/addresses/classifications");
      const classMap = {};
      response.data.classifications.forEach(c => {
        classMap[c.address.toLowerCase()] = c.classification;
      });
      setAddressClassifications(classMap);
    } catch (error) {
      console.error("Error fetching address classifications:", error);
    }
  };

  const classifyAddress = async (address, classification) => {
    try {
      await api.post("/addresses/classify", { address, classification });
      toast.success(
        classification === "trusted" ? "Adresse marquée comme fiable" :
        classification === "suspicious" ? "Adresse marquée comme suspecte" :
        "Classification retirée"
      );
      fetchAddressClassifications();
    } catch (error) {
      toast.error("Erreur lors de la classification");
    }
  };

  // Check if address is a user's wallet
  const isUserWallet = (address) => {
    if (!address) return false;
    const addrLower = address.toLowerCase();
    return wallets.some(w => w.address && w.address.toLowerCase() === addrLower);
  };

  const getAddressColor = (address) => {
    if (!address) return "neutral";
    
    // First check if it's user's own wallet - always trusted
    if (isUserWallet(address)) return "trusted";
    
    // Then check classifications
    const classification = addressClassifications[address.toLowerCase()];
    return classification || "neutral";
  };

  // Get wallet name for an address if it's user's wallet
  const getWalletNameForAddress = (address) => {
    if (!address) return null;
    const addrLower = address.toLowerCase();
    const wallet = wallets.find(w => w.address && w.address.toLowerCase() === addrLower);
    return wallet ? wallet.name : null;
  };

  useEffect(() => {
    fetchWallets();
    fetchFiatAccounts();
    fetchAddressClassifications();
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleCreateTransaction = async () => {
    try {
      const wallet = wallets.find(w => w.id === newTransaction.wallet_id);
      // Combine date and time into a single datetime string
      const dateTime = newTransaction.time 
        ? `${newTransaction.date}T${newTransaction.time}:00`
        : newTransaction.date;
      
      const { time, ...transactionData } = newTransaction;
      const response = await api.post("/transactions", {
        ...transactionData,
        date: dateTime,
        wallet_name: wallet?.name || "Unknown",
        value_usd: newTransaction.amount * newTransaction.price_usd,
        value_eur: newTransaction.amount * newTransaction.price_eur
      });
      toast.success(response.data.message || "Transaction créée");
      setDialogOpen(false);
      // Reset form with current date/time
      setNewTransaction({
        type: "Buy", asset: "USDC", amount: 0, price_usd: 1, price_eur: 0.92,
        value_usd: 0, value_eur: 0, fees: 0, fees_currency: "EUR", wallet_id: "", wallet_name: "",
        source: "manual", 
        date: new Date().toISOString().split("T")[0], 
        time: new Date().toTimeString().slice(0, 5),
        counterparty_wallet: "",
        target_wallet_id: "none",
        create_counterpart_tx: false
      });
      fetchTransactions();
    } catch (error) {
      toast.error("Erreur lors de la création");
    }
  };

  const handleImportCSV = async () => {
    if (!selectedWalletForImport || !csvData) {
      toast.error("Sélectionnez un wallet et ajoutez les données CSV");
      return;
    }
    try {
      await api.post("/transactions/import-csv", { wallet_id: selectedWalletForImport, csv_data: csvData });
      toast.success("Import CSV réussi");
      setCsvDialogOpen(false);
      setCsvData("");
      fetchTransactions();
    } catch (error) {
      toast.error("Erreur lors de l'import CSV");
    }
  };

  // Export transactions to CSV - ALL transactions matching current filters
  const handleExportTransactionsCSV = async () => {
    try {
      toast.info("Récupération de toutes les transactions...");
      
      // Fetch ALL transactions with current filters (no pagination limit)
      const params = {
        page: 1,
        page_size: 200, // Max allowed by backend
        ...(filters.wallet_ids.length > 0 && { wallet_ids: filters.wallet_ids.join(",") }),
        ...(filters.assets.length > 0 && { assets: filters.assets.join(",") }),
        ...(filters.tx_types.length > 0 && { tx_types: filters.tx_types.join(",") }),
        ...(filters.start_date && { start_date: filters.start_date }),
        ...(filters.end_date && { end_date: filters.end_date }),
        hide_spam: filters.hide_spam,
        include_fiat: filters.include_fiat,
        ...(filters.fiat_account_ids.length > 0 && { fiat_account_ids: filters.fiat_account_ids.join(",") })
      };
      
      // Fetch all pages
      let allTransactions = [];
      let currentPage = 1;
      let totalPages = 1;
      
      do {
        const response = await api.get("/transactions", { params: { ...params, page: currentPage } });
        allTransactions = [...allTransactions, ...response.data.transactions];
        totalPages = response.data.total_pages || 1;
        currentPage++;
      } while (currentPage <= totalPages);
      
      if (allTransactions.length === 0) {
        toast.error("Aucune transaction à exporter");
        return;
      }
    
      const headers = ["Date", "Type", "Libellé", "Asset", "Amount", "Price EUR", "Value EUR", "Fees", "Fees Currency", "Wallet", "Source", "Counterparty", "TX Hash", "Is Spam"];
      const categoryLabels = {
        "interest": "Intérêts",
        "yield": "Rendement",
        "airdrop": "Airdrop",
        "reward": "Récompense",
        "cashback": "Cashback",
        "fee": "Frais",
        "gas": "Gas",
        "subscription": "Abonnement",
        "payment": "Paiement"
      };
      const rows = allTransactions.map(tx => [
        tx.date,
        tx.type,
        categoryLabels[tx.income_category] || "",
        tx.asset,
        tx.amount,
        tx.price_eur,
        tx.value_eur,
        tx.fees || 0,
        tx.fees_currency || "EUR",
        tx.wallet_name,
        tx.source,
        tx.counterparty_wallet || "",
        tx.tx_hash || "",
        tx.is_spam ? "Yes" : "No"
      ]);
    
      const csvContent = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transactions_export_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Export CSV téléchargé (${allTransactions.length} transactions)`);
    } catch (error) {
      toast.error("Erreur lors de l'export");
    }
  };

  // Fetch missing fees from blockchain
  const handleFetchMissingFees = async () => {
    try {
      toast.info("Récupération des frais en cours...");
      const response = await api.post("/transactions/fetch-fees");
      if (response.data.updated_count > 0) {
        toast.success(response.data.message);
        fetchTransactions();
      } else {
        toast.info(response.data.message);
      }
      if (response.data.errors && response.data.errors.length > 0) {
        console.warn("Erreurs lors de la récupération:", response.data.errors);
      }
    } catch (error) {
      toast.error("Erreur lors de la récupération des frais");
    }
  };

  // Create missing double-entries for internal transfers
  const handleCreateDoubleEntries = async () => {
    try {
      toast.info("Création des double-entries en cours...");
      const response = await api.post("/transactions/create-double-entries");
      if (response.data.created_count > 0) {
        toast.success(response.data.message);
        fetchTransactions();
      } else {
        toast.info(response.data.message);
      }
    } catch (error) {
      toast.error("Erreur lors de la création des double-entries");
    }
  };

  // Mark all wallet addresses as trusted
  const handleMarkWalletsTrusted = async () => {
    try {
      toast.info("Marquage des adresses de wallets...");
      const response = await api.post("/addresses/mark-wallets-trusted");
      toast.success(response.data.message);
      fetchAddressClassifications();
    } catch (error) {
      toast.error("Erreur lors du marquage");
    }
  };

  const toggleSpam = async (txId) => {
    try {
      const response = await api.patch(`/transactions/${txId}/spam`);
      toast.success(response.data.message);
      fetchTransactions();
    } catch (error) {
      toast.error("Erreur lors du changement de statut spam");
    }
  };

  // Ouvrir le dialog d'édition pour une transaction crypto
  const openEditCryptoDialog = (tx) => {
    const txDate = new Date(tx.date);
    setEditingCryptoTx({
      ...tx,
      date: txDate.toISOString().split("T")[0],
      time: txDate.toTimeString().slice(0, 5),
      amount: Math.abs(tx.amount)
    });
    setEditCryptoDialogOpen(true);
  };

  // Mettre à jour une transaction crypto
  const handleUpdateCryptoTransaction = async () => {
    if (!editingCryptoTx) return;
    try {
      const dateTime = editingCryptoTx.time 
        ? `${editingCryptoTx.date}T${editingCryptoTx.time}:00`
        : editingCryptoTx.date;
      
      // Adjust amount sign based on type
      let finalAmount = Math.abs(editingCryptoTx.amount);
      if (["Sell", "Transfer Out"].includes(editingCryptoTx.type)) {
        finalAmount = -finalAmount;
      }
      
      await api.put(`/transactions/${editingCryptoTx.id}`, {
        type: editingCryptoTx.type,
        asset: editingCryptoTx.asset,
        amount: finalAmount,
        price_usd: editingCryptoTx.price_usd,
        price_eur: editingCryptoTx.price_eur,
        fees: editingCryptoTx.fees,
        fees_currency: editingCryptoTx.fees_currency,
        date: dateTime,
        counterparty_wallet: editingCryptoTx.counterparty_wallet
      });
      toast.success("Transaction modifiée");
      setEditCryptoDialogOpen(false);
      setEditingCryptoTx(null);
      fetchTransactions();
    } catch (error) {
      const msg = error.response?.data?.detail || "Erreur lors de la modification";
      toast.error(msg);
    }
  };

  // Supprimer une transaction crypto
  const handleDeleteCryptoTransaction = async (txId, txCategory) => {
    if (txCategory === "fiat") {
      toast.error("Utilisez la page Fiat pour supprimer les transactions fiat");
      return;
    }
    if (window.confirm("Supprimer cette transaction ?")) {
      try {
        await api.delete(`/transactions/${txId}`);
        toast.success("Transaction supprimée");
        fetchTransactions();
      } catch (error) {
        toast.error("Erreur lors de la suppression");
      }
    }
  };

  // Check if transaction is editable (manual or csv_import only)
  const isTransactionEditable = (tx) => {
    return tx.tx_category !== "fiat" && ["manual", "csv_import"].includes(tx.source);
  };

  const toggleFilter = (filterType, value) => {
    setFilters(prev => {
      const currentValues = prev[filterType];
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value];
      return { ...prev, [filterType]: newValues };
    });
  };

  const getTypeColor = (type) => {
    switch (type) {
      case "Transfer In": case "Buy": return "positive";
      case "Transfer Out": case "Sell": return "negative";
      default: return "neutral";
    }
  };

  const txTypes = ["Buy", "Sell", "Transfer In", "Transfer Out"];

  return (
    <div className="page-content" data-testid="transactions-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Transactions</h1>
          <p className="page-subtitle">Track your transaction history</p>
        </div>
        <div className="header-actions">
          <Dialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="import-csv-btn">
                <Upload size={16} className="mr-2" />
                Import CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Import Transactions from CSV</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Select Wallet</Label>
                  <Select value={selectedWalletForImport} onValueChange={setSelectedWalletForImport}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose wallet" />
                    </SelectTrigger>
                    <SelectContent>
                      {wallets.map((w) => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>CSV Data</Label>
                  <textarea 
                    className="w-full h-40 p-3 bg-background border rounded-md text-sm"
                    placeholder="type,asset,amount,price_usd,price_eur,value_usd,value_eur,fees,date,tx_hash&#10;Buy,USDC,100,1,0.92,100,92,2.5,2024-01-15,0x123..."
                    value={csvData}
                    onChange={(e) => setCsvData(e.target.value)}
                    data-testid="csv-input"
                  />
                </div>
                <Button onClick={handleImportCSV} className="w-full" data-testid="submit-csv-btn">
                  Import Transactions
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          <Button variant="outline" onClick={handleExportTransactionsCSV} data-testid="export-transactions-csv-btn">
            <Download size={16} className="mr-2" />
            Export CSV
          </Button>
          
          <Button variant="outline" onClick={handleFetchMissingFees} data-testid="fetch-fees-btn" title="Récupérer les frais de gas manquants depuis la blockchain">
            <RefreshCw size={16} className="mr-2" />
            Récupérer Fees
          </Button>
          
          <Button variant="outline" onClick={handleCreateDoubleEntries} data-testid="create-double-entries-btn" title="Créer les écritures miroir pour les transferts entre vos wallets">
            <ArrowLeftRight size={16} className="mr-2" />
            Double-Entry
          </Button>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="add-transaction-btn">
                <Plus size={16} className="mr-2" />
                Add Transaction
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Transaction</DialogTitle>
              </DialogHeader>
              <div className="dialog-form space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Type</Label>
                    <Select value={newTransaction.type} onValueChange={(v) => setNewTransaction({...newTransaction, type: v})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Buy">Buy</SelectItem>
                        <SelectItem value="Sell">Sell</SelectItem>
                        <SelectItem value="Transfer In">Transfer In</SelectItem>
                        <SelectItem value="Transfer Out">Transfer Out</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Asset</Label>
                    <Select value={newTransaction.asset} onValueChange={(v) => setNewTransaction({...newTransaction, asset: v})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USDC">USDC</SelectItem>
                        <SelectItem value="EURC">EURC</SelectItem>
                        <SelectItem value="AGEUR">AGEUR</SelectItem>
                        <SelectItem value="ZCHF">ZCHF</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Amount</Label>
                    <Input 
                      type="number"
                      value={newTransaction.amount}
                      onChange={(e) => setNewTransaction({...newTransaction, amount: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <Label>Wallet</Label>
                    <Select value={newTransaction.wallet_id} onValueChange={(v) => setNewTransaction({...newTransaction, wallet_id: v})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select wallet" />
                      </SelectTrigger>
                      <SelectContent>
                        {wallets.map((w) => (
                          <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Price EUR</Label>
                    <Input 
                      type="number"
                      step="0.0001"
                      value={newTransaction.price_eur}
                      onChange={(e) => setNewTransaction({...newTransaction, price_eur: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <Label>Date</Label>
                    <Input 
                      type="date"
                      value={newTransaction.date}
                      onChange={(e) => setNewTransaction({...newTransaction, date: e.target.value})}
                      data-testid="transaction-date-input"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Heure</Label>
                    <Input 
                      type="time"
                      value={newTransaction.time}
                      onChange={(e) => setNewTransaction({...newTransaction, time: e.target.value})}
                      data-testid="transaction-time-input"
                    />
                  </div>
                  <div>
                    <Label>Prix USD</Label>
                    <Input 
                      type="number"
                      step="0.0001"
                      value={newTransaction.price_usd}
                      onChange={(e) => setNewTransaction({...newTransaction, price_usd: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Fees (EUR)</Label>
                    <Input 
                      type="number"
                      value={newTransaction.fees}
                      onChange={(e) => setNewTransaction({...newTransaction, fees: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <Label>Counterparty</Label>
                    <Input 
                      value={newTransaction.counterparty_wallet}
                      onChange={(e) => setNewTransaction({...newTransaction, counterparty_wallet: e.target.value})}
                      placeholder="Source/Destination"
                    />
                  </div>
                </div>
                
                {/* Interdépendance Crypto ↔ Crypto pour les transferts */}
                {(newTransaction.type === "Transfer Out" || newTransaction.type === "Transfer In") && (
                  <div className="border-t pt-4 mt-2">
                    <Label className="text-sm text-muted-foreground mb-2 block">Interdépendance - Transfert Interne (optionnel)</Label>
                    <div className="space-y-3">
                      <div>
                        <Label>Wallet {newTransaction.type === "Transfer Out" ? "Destinataire" : "Source"}</Label>
                        <Select 
                          value={newTransaction.target_wallet_id} 
                          onValueChange={(v) => setNewTransaction({...newTransaction, target_wallet_id: v})}
                        >
                          <SelectTrigger><SelectValue placeholder="Sélectionner un wallet interne..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Aucun (wallet externe)</SelectItem>
                            {wallets.filter(w => w.id !== newTransaction.wallet_id).map(w => (
                              <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {newTransaction.target_wallet_id && newTransaction.target_wallet_id !== "none" && (
                        <div className="flex items-center space-x-2">
                          <input 
                            type="checkbox" 
                            id="create_counterpart_tx"
                            checked={newTransaction.create_counterpart_tx}
                            onChange={(e) => setNewTransaction({...newTransaction, create_counterpart_tx: e.target.checked})}
                            className="rounded"
                          />
                          <Label htmlFor="create_counterpart_tx" className="text-sm cursor-pointer">
                            Créer automatiquement la transaction contrepartie ({newTransaction.type === "Transfer Out" ? "Transfer In" : "Transfer Out"})
                          </Label>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <Button onClick={handleCreateTransaction} className="w-full" data-testid="submit-transaction-btn">
                  Add Transaction
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="filters-card mb-6">
        <CardContent className="pt-4">
          {/* Address Comparison Section - AU DESSUS des filtres */}
          <div className="address-compare-section flex items-center gap-3 mb-4 pb-4 border-b border-zinc-700">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Comparer :</span>
            <Input 
              type="text" 
              placeholder="Adresse 1 (coller ici)" 
              value={compareAddress1}
              onChange={(e) => setCompareAddress1(e.target.value.trim())}
              className="font-mono text-xs"
              style={{ width: '420px', minWidth: '420px' }}
            />
            <span className="text-muted-foreground">&</span>
            <Input 
              type="text" 
              placeholder="Adresse 2 (coller ici)" 
              value={compareAddress2}
              onChange={(e) => setCompareAddress2(e.target.value.trim())}
              className="font-mono text-xs"
              style={{ width: '420px', minWidth: '420px' }}
            />
            {/* Comparison indicator */}
            {(compareAddress1 || compareAddress2) && (
              <div className="flex items-center gap-2">
                {compareAddress1 && compareAddress2 ? (
                  compareAddress1.toLowerCase() === compareAddress2.toLowerCase() ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-green-500/20 border border-green-500/50">
                      <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="text-green-400 text-sm font-medium">Identiques</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-red-500/20 border border-red-500/50">
                      <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                      <span className="text-red-400 text-sm font-medium">Différentes</span>
                    </div>
                  )
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-zinc-700/50 border border-zinc-600">
                    <div className="w-3 h-3 rounded-full bg-zinc-500"></div>
                    <span className="text-zinc-400 text-sm">En attente...</span>
                  </div>
                )}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => { setCompareAddress1(""); setCompareAddress2(""); }}
                  className="text-zinc-400 hover:text-zinc-200"
                >
                  Effacer
                </Button>
              </div>
            )}
          </div>

          <div className="filters-row flex-wrap gap-3">
            {/* Multi-select Wallets */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-40 justify-between text-foreground" style={{ backgroundColor: '#27272a' }}>
                  {filters.wallet_ids.length === 0 ? "All Wallets" : `${filters.wallet_ids.length} wallet(s)`}
                  <ChevronLeft size={16} className="rotate-[-90deg]" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" style={{ backgroundColor: '#27272a', color: '#fafafa' }}>
                <div className="space-y-2">
                  {wallets.map((w) => (
                    <div key={w.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`wallet-${w.id}`}
                        checked={filters.wallet_ids.includes(w.id)}
                        onCheckedChange={() => toggleFilter('wallet_ids', w.id)}
                      />
                      <label htmlFor={`wallet-${w.id}`} className="text-sm cursor-pointer">{w.name}</label>
                    </div>
                  ))}
                  {filters.wallet_ids.length > 0 && (
                    <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => setFilters(prev => ({...prev, wallet_ids: []}))}>
                      Réinitialiser
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Multi-select Fiat Accounts */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-40 justify-between text-foreground" style={{ backgroundColor: '#27272a' }}>
                  <DollarSign size={14} className="mr-1" />
                  {filters.fiat_account_ids.length === 0 ? "Comptes Fiat" : `${filters.fiat_account_ids.length} compte(s)`}
                  <ChevronLeft size={16} className="rotate-[-90deg]" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" style={{ backgroundColor: '#27272a', color: '#fafafa' }}>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 pb-2 border-b border-zinc-600">
                    <Checkbox 
                      id="include-fiat"
                      checked={filters.include_fiat}
                      onCheckedChange={(checked) => setFilters(prev => ({...prev, include_fiat: checked}))}
                    />
                    <label htmlFor="include-fiat" className="text-sm cursor-pointer font-medium">Inclure transactions Fiat</label>
                  </div>
                  {filters.include_fiat && fiatAccounts.map((a) => (
                    <div key={a.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`fiat-${a.id}`}
                        checked={filters.fiat_account_ids.includes(a.id)}
                        onCheckedChange={() => toggleFilter('fiat_account_ids', a.id)}
                      />
                      <label htmlFor={`fiat-${a.id}`} className="text-sm cursor-pointer">{a.name} ({a.currency})</label>
                    </div>
                  ))}
                  {filters.fiat_account_ids.length > 0 && (
                    <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => setFilters(prev => ({...prev, fiat_account_ids: []}))}>
                      Réinitialiser
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Multi-select Assets */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-36 justify-between text-foreground" style={{ backgroundColor: '#27272a' }}>
                  {filters.assets.length === 0 ? "All Assets" : `${filters.assets.length} asset(s)`}
                  <ChevronLeft size={16} className="rotate-[-90deg]" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" style={{ backgroundColor: '#27272a', color: '#fafafa' }}>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {availableAssets.map((asset) => (
                    <div key={asset} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`asset-${asset}`}
                        checked={filters.assets.includes(asset)}
                        onCheckedChange={() => toggleFilter('assets', asset)}
                      />
                      <label htmlFor={`asset-${asset}`} className="text-sm cursor-pointer">{asset}</label>
                    </div>
                  ))}
                  {filters.assets.length > 0 && (
                    <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => setFilters(prev => ({...prev, assets: []}))}>
                      Réinitialiser
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Multi-select Types */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-36 justify-between text-foreground" style={{ backgroundColor: '#27272a' }}>
                  {filters.tx_types.length === 0 ? "All Types" : `${filters.tx_types.length} type(s)`}
                  <ChevronLeft size={16} className="rotate-[-90deg]" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" style={{ backgroundColor: '#27272a', color: '#fafafa' }}>
                <div className="space-y-2">
                  {txTypes.map((type) => (
                    <div key={type} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`type-${type}`}
                        checked={filters.tx_types.includes(type)}
                        onCheckedChange={() => toggleFilter('tx_types', type)}
                      />
                      <label htmlFor={`type-${type}`} className="text-sm cursor-pointer">{type}</label>
                    </div>
                  ))}
                  {filters.tx_types.length > 0 && (
                    <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => setFilters(prev => ({...prev, tx_types: []}))}>
                      Réinitialiser
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <Input type="date" value={filters.start_date} onChange={(e) => setFilters({...filters, start_date: e.target.value})} className="w-36" />
            <span className="filter-separator text-foreground">à</span>
            <Input type="date" value={filters.end_date} onChange={(e) => setFilters({...filters, end_date: e.target.value})} className="w-36" />
            
            {/* Hide spam toggle */}
            <div className="flex items-center space-x-2 ml-4">
              <Checkbox 
                id="hide-spam"
                checked={filters.hide_spam}
                onCheckedChange={(checked) => setFilters(prev => ({...prev, hide_spam: checked}))}
              />
              <label htmlFor="hide-spam" className="text-sm cursor-pointer text-foreground">Masquer spam</label>
            </div>
            
            <div className="filter-count text-foreground">{pagination.total} transactions</div>
          </div>
        </CardContent>
      </Card>

      <Card className="table-card">
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Catégorie</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-xs">Libellé</TableHead>
                <TableHead>Asset</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Prix/Débit</TableHead>
                <TableHead>Valeur/Crédit</TableHead>
                <TableHead>Fees</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow key={tx.id} className={`${tx.is_spam ? "opacity-50 bg-red-900/20" : ""} ${tx.tx_category === "fiat" ? "bg-blue-900/10" : ""}`}>
                  {/* Category Badge */}
                  <TableCell>
                    <Badge variant={tx.tx_category === "fiat" ? "secondary" : "outline"} className={tx.tx_category === "fiat" ? "bg-blue-600/30 text-blue-300" : "bg-purple-600/30 text-purple-300"}>
                      {tx.tx_category === "fiat" ? <DollarSign size={12} className="mr-1" /> : <Wallet size={12} className="mr-1" />}
                      {tx.tx_category === "fiat" ? "Fiat" : "Crypto"}
                    </Badge>
                  </TableCell>
                  {/* Type */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge className={`type-badge ${tx.tx_category === "fiat" 
                        ? (tx.amount >= 0 ? "positive" : "negative")
                        : getTypeColor(tx.type)}`}>
                        {tx.tx_category === "fiat" 
                          ? (tx.type === "deposit" ? "Dépôt" :
                             tx.type === "withdrawal" ? "Retrait" :
                             tx.type === "crypto_buy" ? "Achat Crypto" :
                             tx.type === "crypto_sell" ? "Vente Crypto" :
                             tx.type === "transfer_in" ? "Virement +" :
                             tx.type === "transfer_out" ? "Virement -" : tx.type)
                          : tx.type}
                      </Badge>
                      {tx.is_spam && <Badge variant="destructive" className="text-xs">SPAM</Badge>}
                    </div>
                  </TableCell>
                  {/* Libellé (income_category) - seulement pour crypto */}
                  <TableCell>
                    {tx.tx_category === "crypto" ? (
                      <Select 
                        value={tx.income_category || "none"} 
                        onValueChange={async (value) => {
                          try {
                            const categoryValue = value === "none" ? null : value;
                            await api.patch(`/transactions/${tx.id}/category`, { income_category: categoryValue });
                            toast.success("Catégorie mise à jour");
                            // Refresh transactions
                            fetchTransactions();
                          } catch (error) {
                            toast.error("Erreur lors de la mise à jour");
                          }
                        }}
                      >
                        <SelectTrigger className="h-7 text-xs w-[100px] bg-transparent border-zinc-700">
                          <SelectValue placeholder="-" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Aucun</SelectItem>
                          <SelectItem value="interest" className="text-green-400">💰 Intérêts</SelectItem>
                          <SelectItem value="yield" className="text-green-400">📈 Rendement</SelectItem>
                          <SelectItem value="airdrop" className="text-cyan-400">🎁 Airdrop</SelectItem>
                          <SelectItem value="reward" className="text-yellow-400">⭐ Récompense</SelectItem>
                          <SelectItem value="cashback" className="text-purple-400">💸 Cashback</SelectItem>
                          <SelectItem value="fee" className="text-red-400">💳 Frais</SelectItem>
                          <SelectItem value="gas" className="text-orange-400">⛽ Gas</SelectItem>
                          <SelectItem value="subscription" className="text-blue-400">📅 Abonnement</SelectItem>
                          <SelectItem value="payment" className="text-red-400">💳 Paiement</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-zinc-500 text-xs">-</span>
                    )}
                  </TableCell>
                  {/* Asset */}
                  <TableCell className="font-medium">
                    {tx.tx_category === "fiat" ? tx.currency || tx.asset : tx.asset}
                  </TableCell>
                  {/* Amount */}
                  <TableCell className={
                    tx.tx_category === "fiat" 
                      ? (tx.amount >= 0 ? "text-green-400" : "text-red-400")
                      : (tx.type?.includes("Out") || tx.type === "Sell" ? "text-red-400" : "text-green-400")
                  }>
                    {tx.tx_category === "fiat" 
                      ? `${tx.amount >= 0 ? "+" : ""}${tx.amount?.toFixed(2)}`
                      : `${tx.type?.includes("Out") || tx.type === "Sell" ? "-" : "+"}${Math.abs(tx.amount).toLocaleString()}`}
                  </TableCell>
                  {/* Price/Debit */}
                  <TableCell>
                    {tx.tx_category === "fiat" 
                      ? (tx.debit > 0 ? <span className="text-red-400">{tx.debit?.toFixed(2)}</span> : "-")
                      : `€${tx.price_eur?.toFixed(4)}`}
                  </TableCell>
                  {/* Value/Credit */}
                  <TableCell className="font-medium">
                    {tx.tx_category === "fiat" 
                      ? (tx.credit > 0 ? <span className="text-green-400">{tx.credit?.toFixed(2)}</span> : "-")
                      : `€${tx.value_eur?.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}`}
                  </TableCell>
                  {/* Fees */}
                  <TableCell className="text-amber-400 font-mono text-sm">
                    {tx.fees > 0 ? (
                      <span title={`${tx.fees} ${tx.fees_currency || 'EUR'}`}>
                        {tx.fees < 0.0001 ? tx.fees.toExponential(2) : tx.fees.toFixed(4)} {tx.fees_currency || 'EUR'}
                      </span>
                    ) : (
                      <span className="text-zinc-500">-</span>
                    )}
                  </TableCell>
                  {/* Source - pour crypto: dépend du type de transaction */}
                  <TableCell>
                    {tx.tx_category === "fiat" ? (
                      tx.source_name ? (
                        <div className="flex items-center gap-1 text-sm">
                          {tx.source_type === "bank" ? <DollarSign size={12} className="text-blue-400" /> : 
                           tx.source_type === "wallet" ? <Wallet size={12} className="text-purple-400" /> : null}
                          <span className="truncate max-w-[100px]">{tx.source_name}</span>
                        </div>
                      ) : tx.source_wallet_address ? (
                        <span className="font-mono text-xs">{tx.source_wallet_address.substring(0, 10)}...</span>
                      ) : "-"
                    ) : (
                      // Pour crypto: Source = counterparty si Transfer In/Deposit/Buy, sinon wallet_name
                      ["Transfer In", "Deposit", "Buy"].includes(tx.type) ? (
                        tx.counterparty_wallet ? (
                          <TooltipProvider>
                            <Tooltip delayDuration={300}>
                              <TooltipTrigger asChild>
                                <span>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button 
                                        className={`counterparty-cell cursor-pointer hover:opacity-80 px-2 py-1 rounded ${
                                          getAddressColor(tx.counterparty_wallet) === "trusted" 
                                            ? "bg-green-500/20 text-green-400 border border-green-500/50" 
                                            : getAddressColor(tx.counterparty_wallet) === "suspicious"
                                            ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/50"
                                            : "text-foreground"
                                        }`}
                                      >
                                        {getAddressColor(tx.counterparty_wallet) === "trusted" && <Shield size={12} className="inline mr-1" />}
                                        {getAddressColor(tx.counterparty_wallet) === "suspicious" && <AlertTriangle size={12} className="inline mr-1" />}
                                        {getWalletNameForAddress(tx.counterparty_wallet) || tx.counterparty_wallet.substring(0, 10) + "..."}
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent style={{ backgroundColor: '#27272a', color: '#fafafa' }}>
                                      <DropdownMenuItem 
                                        onClick={() => classifyAddress(tx.counterparty_wallet, "trusted")}
                                        className="cursor-pointer hover:bg-green-500/20"
                                      >
                                        <Shield size={14} className="mr-2 text-green-500" />
                                        <span className="text-green-400">Marquer comme fiable</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={() => classifyAddress(tx.counterparty_wallet, "suspicious")}
                                        className="cursor-pointer hover:bg-yellow-500/20"
                                      >
                                        <AlertTriangle size={14} className="mr-2 text-yellow-500" />
                                        <span className="text-yellow-400">Marquer comme suspect</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={() => classifyAddress(tx.counterparty_wallet, "neutral")}
                                        className="cursor-pointer hover:bg-gray-500/20"
                                      >
                                        <Circle size={14} className="mr-2 text-gray-400" />
                                        <span className="text-gray-400">Retirer la classification</span>
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="bg-zinc-800 text-zinc-100 font-mono text-xs max-w-none">
                                <div className="flex items-center gap-2">
                                  <span>{tx.counterparty_wallet}</span>
                                  <Copy 
                                    size={12} 
                                    className="cursor-pointer hover:text-blue-400 transition-colors" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(tx.counterparty_wallet);
                                      toast.success("Adresse copiée !");
                                    }}
                                  />
                                  <ExternalLink 
                                    size={12} 
                                    className="cursor-pointer hover:text-green-400 transition-colors" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const url = getExplorerAddressUrl(tx.counterparty_wallet, tx.wallet_name);
                                      if (url) window.open(url, "_blank");
                                    }}
                                  />
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Cliquez pour classifier</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : <span className="text-zinc-500">Externe</span>
                      ) : (
                        <span className="wallet-name-cell">{tx.wallet_name}</span>
                      )
                    )}
                  </TableCell>
                  {/* Destination - pour crypto: dépend du type de transaction */}
                  <TableCell>
                    {tx.tx_category === "fiat" ? (
                      tx.dest_name ? (
                        <div className="flex items-center gap-1 text-sm">
                          {tx.dest_type === "bank" ? <DollarSign size={12} className="text-blue-400" /> : 
                           tx.dest_type === "wallet" ? <Wallet size={12} className="text-purple-400" /> : null}
                          <span className="truncate max-w-[100px]">{tx.dest_name}</span>
                        </div>
                      ) : tx.dest_wallet_address ? (
                        <span className="font-mono text-xs">{tx.dest_wallet_address.substring(0, 10)}...</span>
                      ) : tx.account_name || "-"
                    ) : (
                      // Pour crypto: Destination = wallet_name si Transfer In/Deposit/Buy, sinon counterparty
                      ["Transfer In", "Deposit", "Buy"].includes(tx.type) ? (
                        <span className="wallet-name-cell">{tx.wallet_name}</span>
                      ) : (
                        tx.counterparty_wallet ? (
                        <TooltipProvider>
                          <Tooltip delayDuration={300}>
                            <TooltipTrigger asChild>
                              <span>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button 
                                      className={`counterparty-cell cursor-pointer hover:opacity-80 px-2 py-1 rounded ${
                                        getAddressColor(tx.counterparty_wallet) === "trusted" 
                                          ? "bg-green-500/20 text-green-400 border border-green-500/50" 
                                          : getAddressColor(tx.counterparty_wallet) === "suspicious"
                                          ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/50"
                                          : "text-foreground"
                                      }`}
                                    >
                                      {getAddressColor(tx.counterparty_wallet) === "trusted" && <Shield size={12} className="inline mr-1" />}
                                      {getAddressColor(tx.counterparty_wallet) === "suspicious" && <AlertTriangle size={12} className="inline mr-1" />}
                                      {getWalletNameForAddress(tx.counterparty_wallet) || tx.counterparty_wallet.substring(0, 10) + "..."}
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent style={{ backgroundColor: '#27272a', color: '#fafafa' }}>
                                    <DropdownMenuItem 
                                      onClick={() => classifyAddress(tx.counterparty_wallet, "trusted")}
                                      className="cursor-pointer hover:bg-green-500/20"
                                    >
                                      <Shield size={14} className="mr-2 text-green-500" />
                                      <span className="text-green-400">Marquer comme fiable</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={() => classifyAddress(tx.counterparty_wallet, "suspicious")}
                                      className="cursor-pointer hover:bg-yellow-500/20"
                                    >
                                      <AlertTriangle size={14} className="mr-2 text-yellow-500" />
                                      <span className="text-yellow-400">Marquer comme suspect</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={() => classifyAddress(tx.counterparty_wallet, "neutral")}
                                      className="cursor-pointer hover:bg-gray-500/20"
                                    >
                                      <Circle size={14} className="mr-2 text-gray-400" />
                                      <span className="text-gray-400">Retirer la classification</span>
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-zinc-800 text-zinc-100 font-mono text-xs max-w-none">
                              <div className="flex items-center gap-2">
                                <span>{tx.counterparty_wallet}</span>
                                <Copy 
                                  size={12} 
                                  className="cursor-pointer hover:text-blue-400 transition-colors" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(tx.counterparty_wallet);
                                    toast.success("Adresse copiée !");
                                  }}
                                />
                                <ExternalLink 
                                  size={12} 
                                  className="cursor-pointer hover:text-green-400 transition-colors" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const url = getExplorerAddressUrl(tx.counterparty_wallet, tx.wallet_name);
                                    if (url) window.open(url, "_blank");
                                  }}
                                />
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">Cliquez pour classifier</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : "-"
                      )
                    )}
                  </TableCell>
                  <TableCell>{new Date(tx.date).toLocaleDateString("fr-FR")}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {/* Edit button - only for manual crypto transactions */}
                      {isTransactionEditable(tx) && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                          onClick={() => openEditCryptoDialog(tx)}
                          title="Modifier"
                          data-testid={`edit-crypto-tx-${tx.id}`}
                        >
                          <Edit2 size={16} />
                        </Button>
                      )}
                      {/* Spam toggle - only for crypto */}
                      {tx.tx_category !== "fiat" && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={tx.is_spam ? "text-green-500 hover:text-green-600" : "text-orange-500 hover:text-orange-600"}
                          onClick={() => toggleSpam(tx.id)}
                          title={tx.is_spam ? "Retirer du spam" : "Marquer comme spam"}
                        >
                          {tx.is_spam ? <Check size={16} /> : <Ban size={16} />}
                        </Button>
                      )}
                      {/* Delete button */}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        onClick={() => handleDeleteCryptoTransaction(tx.id, tx.tx_category)}
                        title="Supprimer"
                        data-testid={`delete-crypto-tx-${tx.id}`}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
        
        {/* Dialog d'édition pour transactions crypto */}
        <Dialog open={editCryptoDialogOpen} onOpenChange={setEditCryptoDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Modifier la Transaction Crypto</DialogTitle></DialogHeader>
            {editingCryptoTx && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Type</Label>
                    <Select value={editingCryptoTx.type} onValueChange={(v) => setEditingCryptoTx({...editingCryptoTx, type: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Buy">Buy</SelectItem>
                        <SelectItem value="Sell">Sell</SelectItem>
                        <SelectItem value="Transfer In">Transfer In</SelectItem>
                        <SelectItem value="Transfer Out">Transfer Out</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Asset</Label>
                    <Select value={editingCryptoTx.asset} onValueChange={(v) => setEditingCryptoTx({...editingCryptoTx, asset: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {availableAssets.map(asset => (
                          <SelectItem key={asset} value={asset}>{asset}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Montant</Label>
                    <Input 
                      type="number"
                      step="0.0001"
                      value={editingCryptoTx.amount}
                      onChange={(e) => setEditingCryptoTx({...editingCryptoTx, amount: parseFloat(e.target.value) || 0})}
                      data-testid="edit-crypto-amount-input"
                    />
                  </div>
                  <div>
                    <Label>Prix EUR</Label>
                    <Input 
                      type="number"
                      step="0.0001"
                      value={editingCryptoTx.price_eur}
                      onChange={(e) => setEditingCryptoTx({...editingCryptoTx, price_eur: parseFloat(e.target.value) || 0})}
                      data-testid="edit-crypto-price-eur-input"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Prix USD</Label>
                    <Input 
                      type="number"
                      step="0.0001"
                      value={editingCryptoTx.price_usd}
                      onChange={(e) => setEditingCryptoTx({...editingCryptoTx, price_usd: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <Label>Frais ({editingCryptoTx.fees_currency})</Label>
                    <Input 
                      type="number"
                      step="0.01"
                      value={editingCryptoTx.fees}
                      onChange={(e) => setEditingCryptoTx({...editingCryptoTx, fees: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Date</Label>
                    <Input 
                      type="date"
                      value={editingCryptoTx.date}
                      onChange={(e) => setEditingCryptoTx({...editingCryptoTx, date: e.target.value})}
                      data-testid="edit-crypto-date-input"
                    />
                  </div>
                  <div>
                    <Label>Heure</Label>
                    <Input 
                      type="time"
                      value={editingCryptoTx.time}
                      onChange={(e) => setEditingCryptoTx({...editingCryptoTx, time: e.target.value})}
                    />
                  </div>
                </div>
                
                <div>
                  <Label>Contrepartie (adresse)</Label>
                  <Input 
                    value={editingCryptoTx.counterparty_wallet || ""}
                    onChange={(e) => setEditingCryptoTx({...editingCryptoTx, counterparty_wallet: e.target.value})}
                    placeholder="0x..."
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEditCryptoDialogOpen(false)} className="flex-1">Annuler</Button>
                  <Button onClick={handleUpdateCryptoTransaction} className="flex-1" data-testid="submit-edit-crypto-tx-btn">Enregistrer</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
        
        <div className="pagination-row">
          <Button variant="secondary" size="sm" disabled={pagination.page === 1} onClick={() => setPagination({...pagination, page: pagination.page - 1})}>
            <ChevronLeft size={16} /> Précédent
          </Button>
          <span className="pagination-info">Page {pagination.page} sur {pagination.totalPages} ({pagination.total} total)</span>
          <Button variant="secondary" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => setPagination({...pagination, page: pagination.page + 1})}>
            Suivant <ChevronRight size={16} />
          </Button>
        </div>
      </Card>
    </div>
  );
};

// ==================== P&L PAGE ====================

const PnLPage = () => {
  const { accessToken } = useAuth();
  const [pnlData, setPnlData] = useState({ reports: [], summary: {} });
  const [loading, setLoading] = useState(true);

  const api = createAuthenticatedApi(accessToken);

  useEffect(() => {
    const fetchPnL = async () => {
      try {
        const response = await api.get("/portfolio/pnl");
        setPnlData(response.data);
      } catch (error) {
        toast.error("Erreur lors du chargement du P&L");
      } finally {
        setLoading(false);
      }
    };
    fetchPnL();
  }, []);

  const summary = pnlData.summary || {};

  return (
    <div className="page-content" data-testid="pnl-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">P&L Report (FIFO)</h1>
          <p className="page-subtitle">Profit & Loss calculation using FIFO method in EUR</p>
        </div>
      </div>

      <div className="pnl-summary-grid">
        <Card className={summary.total_realized_pnl_eur >= 0 ? "pnl-positive" : "pnl-negative"}>
          <CardContent className="pt-6">
            <p className="pnl-label">Realized P&L</p>
            <p className="pnl-value">€{(summary.total_realized_pnl_eur || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        
        <Card className={summary.total_unrealized_pnl_eur >= 0 ? "pnl-positive" : "pnl-negative"}>
          <CardContent className="pt-6">
            <p className="pnl-label">Unrealized P&L</p>
            <p className="pnl-value">€{(summary.total_unrealized_pnl_eur || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        
        <Card className={summary.total_pnl_eur >= 0 ? "pnl-positive" : "pnl-negative"}>
          <CardContent className="pt-6">
            <p className="pnl-label">Total P&L</p>
            <p className="pnl-value">€{(summary.total_pnl_eur || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <p className="pnl-label">Total Fees</p>
            <p className="pnl-value text-orange-500 font-bold">€{(summary.total_fees_eur || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>P&L by Asset</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Total Bought</TableHead>
                <TableHead>Total Sold</TableHead>
                <TableHead>Total Cost (EUR)</TableHead>
                <TableHead>Total Proceeds (EUR)</TableHead>
                <TableHead>Realized P&L (EUR)</TableHead>
                <TableHead>Current Holdings</TableHead>
                <TableHead>Current Value (EUR)</TableHead>
                <TableHead>Unrealized P&L (EUR)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pnlData.reports.map((report) => (
                <TableRow key={report.asset} className="text-zinc-100">
                  <TableCell className="font-medium text-zinc-100">{report.asset}</TableCell>
                  <TableCell className="text-zinc-100">{report.total_bought.toLocaleString()}</TableCell>
                  <TableCell className="text-zinc-100">{report.total_sold.toLocaleString()}</TableCell>
                  <TableCell className="text-zinc-100">€{report.total_cost_eur.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-zinc-100">€{report.total_proceeds_eur.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className={report.realized_pnl_eur >= 0 ? "text-green-400" : "text-red-400"}>
                    €{report.realized_pnl_eur.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-zinc-100">{report.current_holdings.toLocaleString()}</TableCell>
                  <TableCell className="text-zinc-100">€{report.current_value_eur.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className={report.unrealized_pnl_eur >= 0 ? "text-green-400" : "text-red-400"}>
                    €{report.unrealized_pnl_eur.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

// ==================== POSITIONS PAGE ====================

const PositionsPage = () => {
  const { accessToken } = useAuth();
  const api = createAuthenticatedApi(accessToken);
  const [positions, setPositions] = useState([]);
  const [totalsByAsset, setTotalsByAsset] = useState({});
  const [globalTotals, setGlobalTotals] = useState({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState(null);
  const [movementDialogOpen, setMovementDialogOpen] = useState(false);
  const [selectedPositionForMovement, setSelectedPositionForMovement] = useState(null);
  const [movementsDialogOpen, setMovementsDialogOpen] = useState(false);
  const [selectedPositionMovements, setSelectedPositionMovements] = useState([]);
  const [wallets, setWallets] = useState([]);  // Pour interdépendance
  const [rulesDialogOpen, setRulesDialogOpen] = useState(false);
  const [selectedPositionForRules, setSelectedPositionForRules] = useState(null);
  const [previewResults, setPreviewResults] = useState(null);
  const [applyingRules, setApplyingRules] = useState(false);
  const [newPosition, setNewPosition] = useState({
    platform: "",
    product_type: "savings",
    asset: "EURA",
    amount: 0,
    apy: 0,
    deposit_date: new Date().toISOString().split("T")[0],
    unlock_date: "",
    notes: "",
    source_wallet_id: "none",
    create_withdrawal_tx: false
  });
  const [newMovement, setNewMovement] = useState({
    movement_type: "yield_realized",
    amount: 0,
    asset: "",
    date: new Date().toISOString().split("T")[0],
    tx_hash: "",
    notes: "",
    target_wallet_id: "none",
    create_deposit_tx: false
  });

  const platforms = ["Bleap", "Neverless", "Frankencoin", "8Lends", "Kraken", "Binance", "Autre"];
  const productTypes = [
    { value: "savings", label: "Savings" },
    { value: "vault", label: "Vault" },
    { value: "strategy", label: "Stratégie" },
    { value: "prime", label: "Prime" },
    { value: "lending", label: "Lending" },
    { value: "staking", label: "Staking" },
    { value: "liquidity", label: "Liquidity Pool" },
    { value: "other", label: "Autre" }
  ];
  const movementTypes = [
    { value: "capital_addition", label: "Ajout de Capital", color: "text-blue-400" },
    { value: "yield_realized", label: "Rendement Réalisé", color: "text-green-400" },
    { value: "capital_withdrawal", label: "Retrait de Capital", color: "text-amber-400" },
    { value: "capital_deposit", label: "Dépôt Capital (auto)", color: "text-purple-400" },
    { value: "impermanent_loss", label: "Perte (Rupture Contrat)", color: "text-red-400" }
  ];
  const assets = ["EURA", "EURC", "ZCHF", "USDC", "USDT", "ETH", "BTC", "EUR", "USD", "CHF"];

  const fetchPositions = async () => {
    try {
      const response = await api.get("/positions");
      setPositions(response.data.positions || []);
      setTotalsByAsset(response.data.totals_by_asset || {});
      setGlobalTotals(response.data.global_totals || {});
    } catch (error) {
      toast.error("Erreur lors du chargement des positions");
    } finally {
      setLoading(false);
    }
  };

  // Charger les wallets pour l'interdépendance
  const fetchWallets = async () => {
    try {
      const response = await api.get("/wallets");
      setWallets(response.data || []);
    } catch (error) {
      console.error("Erreur chargement wallets", error);
    }
  };

  useEffect(() => { 
    fetchPositions(); 
    fetchWallets();
  }, []);

  const handleCreatePosition = async () => {
    if (!newPosition.platform || !newPosition.amount) {
      toast.error("Plateforme et montant requis");
      return;
    }
    try {
      const response = await api.post("/positions", {
        ...newPosition,
        unlock_date: newPosition.unlock_date || null
      });
      toast.success(response.data.message || "Position créée");
      setDialogOpen(false);
      setNewPosition({
        platform: "",
        product_type: "savings",
        asset: "EURA",
        amount: 0,
        apy: 0,
        deposit_date: new Date().toISOString().split("T")[0],
        unlock_date: "",
        notes: "",
        source_wallet_id: "none",
        create_withdrawal_tx: false
      });
      fetchPositions();
    } catch (error) {
      toast.error("Erreur lors de la création");
    }
  };

  // Ouvrir le dialog pour ajouter un mouvement
  const openMovementDialog = (pos) => {
    setSelectedPositionForMovement(pos);
    setNewMovement({
      movement_type: "yield_realized",
      amount: 0,
      asset: pos.asset,
      date: new Date().toISOString().split("T")[0],
      tx_hash: "",
      notes: "",
      target_wallet_id: "none",
      create_deposit_tx: false
    });
    setMovementDialogOpen(true);
  };

  // Créer un mouvement avec interdépendance optionnelle
  const handleCreateMovement = async () => {
    if (!selectedPositionForMovement || !newMovement.amount) {
      toast.error("Montant requis");
      return;
    }
    try {
      const response = await api.post("/position-movements", {
        position_id: selectedPositionForMovement.id,
        ...newMovement
      });
      toast.success(response.data.message || "Mouvement enregistré");
      setMovementDialogOpen(false);
      setSelectedPositionForMovement(null);
      fetchPositions();
    } catch (error) {
      toast.error("Erreur lors de la création du mouvement");
    }
  };

  // Voir les mouvements d'une position
  const viewMovements = async (pos) => {
    try {
      const response = await api.get(`/position-movements/${pos.id}`);
      setSelectedPositionMovements(response.data.movements || []);
      setSelectedPositionForMovement(pos);
      setMovementsDialogOpen(true);
    } catch (error) {
      toast.error("Erreur lors du chargement des mouvements");
    }
  };

  // Supprimer un mouvement
  const handleDeleteMovement = async (movementId) => {
    if (window.confirm("Supprimer ce mouvement ?")) {
      try {
        await api.delete(`/position-movements/${movementId}`);
        toast.success("Mouvement supprimé");
        // Refresh movements list
        if (selectedPositionForMovement) {
          const response = await api.get(`/position-movements/${selectedPositionForMovement.id}`);
          setSelectedPositionMovements(response.data.movements || []);
        }
        fetchPositions();
      } catch (error) {
        toast.error("Erreur lors de la suppression");
      }
    }
  };

  // Export movements to CSV
  const handleExportMovementsCSV = async (positionId) => {
    try {
      const response = await api.get(`/export/position-movements${positionId ? `?position_id=${positionId}` : ''}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `mouvements_positions_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Export CSV téléchargé");
    } catch (error) {
      toast.error("Erreur lors de l'export");
    }
  };

  // ==================== RÈGLES D'AFFECTATION ====================
  
  // Ouvrir le dialog des règles
  const openRulesDialog = (pos) => {
    setSelectedPositionForRules(pos);
    setPreviewResults(null);
    setRulesDialogOpen(true);
  };

  // Prévisualiser les transactions qui matchent
  const handlePreviewRules = async () => {
    if (!selectedPositionForRules) return;
    try {
      const response = await api.get(`/positions/${selectedPositionForRules.id}/preview-rules`);
      setPreviewResults(response.data);
    } catch (error) {
      toast.error("Erreur lors de la prévisualisation");
    }
  };

  // Appliquer les règles
  const handleApplyRules = async () => {
    if (!selectedPositionForRules) return;
    setApplyingRules(true);
    try {
      const response = await api.post(`/positions/${selectedPositionForRules.id}/apply-rules`);
      toast.success(response.data.message);
      setRulesDialogOpen(false);
      fetchPositions();
    } catch (error) {
      toast.error("Erreur lors de l'application des règles");
    } finally {
      setApplyingRules(false);
    }
  };

  // Mettre à jour les règles d'une position
  const handleUpdateRules = async (ruleAddress, ruleAsset, ruleEnabled) => {
    if (!selectedPositionForRules) return;
    try {
      await api.put(`/positions/${selectedPositionForRules.id}`, {
        rule_address: ruleAddress,
        rule_asset: ruleAsset,
        rule_enabled: ruleEnabled
      });
      toast.success("Règles mises à jour");
      // Update local state
      setSelectedPositionForRules({
        ...selectedPositionForRules,
        rule_address: ruleAddress,
        rule_asset: ruleAsset,
        rule_enabled: ruleEnabled
      });
      fetchPositions();
    } catch (error) {
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const getMovementTypeLabel = (value) => {
    const mt = movementTypes.find(m => m.value === value);
    if (value === "capital_deposit") return "Dépôt Capital";
    return mt ? mt.label : value;
  };

  const getMovementTypeColor = (value) => {
    const mt = movementTypes.find(m => m.value === value);
    if (value === "capital_deposit") return "text-purple-400";
    return mt ? mt.color : "text-gray-400";
  };

  const openEditDialog = (pos) => {
    setEditingPosition({
      ...pos,
      deposit_date: pos.deposit_date?.split("T")[0] || "",
      unlock_date: pos.unlock_date?.split("T")[0] || ""
    });
    setEditDialogOpen(true);
  };

  const handleUpdatePosition = async () => {
    if (!editingPosition) return;
    try {
      await api.put(`/positions/${editingPosition.id}`, {
        platform: editingPosition.platform,
        product_type: editingPosition.product_type,
        asset: editingPosition.asset,
        amount: editingPosition.amount,
        apy: editingPosition.apy,
        deposit_date: editingPosition.deposit_date,
        unlock_date: editingPosition.unlock_date || null,
        notes: editingPosition.notes
      });
      toast.success("Position modifiée");
      setEditDialogOpen(false);
      setEditingPosition(null);
      fetchPositions();
    } catch (error) {
      toast.error("Erreur lors de la modification");
    }
  };

  const handleDeletePosition = async (id) => {
    if (window.confirm("Supprimer cette position ?")) {
      try {
        await api.delete(`/positions/${id}`);
        toast.success("Position supprimée");
        fetchPositions();
      } catch (error) {
        toast.error("Erreur lors de la suppression");
      }
    }
  };

  const getProductTypeLabel = (value) => {
    const pt = productTypes.find(p => p.value === value);
    return pt ? pt.label : value;
  };

  // Export positions
  const exportPositions = async () => {
    try {
      const response = await api.get("/export/positions", { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'positions.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Export des positions téléchargé");
    } catch (error) {
      toast.error("Erreur lors de l'export");
    }
  };

  if (loading) return <div className="page-content"><RefreshCw className="animate-spin" /></div>;

  return (
    <div className="page-content" data-testid="positions-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Positions / Investissements</h1>
          <p className="page-subtitle">Gérez vos actifs en épargne, vault, stratégie</p>
        </div>
        <div className="header-actions">
          <Button variant="outline" onClick={exportPositions}>
            <Download size={16} className="mr-2" />
            Export Positions
          </Button>
          <Button variant="outline" onClick={() => handleExportMovementsCSV()}>
            <Download size={16} className="mr-2" />
            Export Mouvements
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="add-position-btn"><Plus size={16} className="mr-2" />Nouvelle Position</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Ajouter une Position</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Plateforme</Label>
                  <Select value={newPosition.platform} onValueChange={(v) => setNewPosition({...newPosition, platform: v})}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                    <SelectContent>
                      {platforms.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Type de Produit</Label>
                  <Select value={newPosition.product_type} onValueChange={(v) => setNewPosition({...newPosition, product_type: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {productTypes.map(pt => <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Asset</Label>
                  <Select value={newPosition.asset} onValueChange={(v) => setNewPosition({...newPosition, asset: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {assets.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Montant</Label>
                  <Input 
                    type="number" 
                    value={newPosition.amount} 
                    onChange={(e) => setNewPosition({...newPosition, amount: parseFloat(e.target.value) || 0})}
                    data-testid="position-amount-input"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>APY (%)</Label>
                  <Input 
                    type="number" 
                    step="0.1"
                    value={newPosition.apy} 
                    onChange={(e) => setNewPosition({...newPosition, apy: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <Label>Date de Dépôt</Label>
                  <Input 
                    type="date" 
                    value={newPosition.deposit_date} 
                    onChange={(e) => setNewPosition({...newPosition, deposit_date: e.target.value})}
                  />
                </div>
              </div>
              
              <div>
                <Label>Date de Déblocage (optionnel)</Label>
                <Input 
                  type="date" 
                  value={newPosition.unlock_date} 
                  onChange={(e) => setNewPosition({...newPosition, unlock_date: e.target.value})}
                  placeholder="Laisser vide si pas de blocage"
                />
              </div>
              
              <div>
                <Label>Notes</Label>
                <Input 
                  value={newPosition.notes} 
                  onChange={(e) => setNewPosition({...newPosition, notes: e.target.value})}
                  placeholder="Notes optionnelles..."
                />
              </div>
              
              {/* Interdépendance: Wallet Source */}
              <div className="border-t pt-4 mt-4">
                <Label className="text-sm text-muted-foreground mb-2 block">Interdépendance (optionnel)</Label>
                <div className="space-y-3">
                  <div>
                    <Label>Wallet Source</Label>
                    <Select value={newPosition.source_wallet_id} onValueChange={(v) => setNewPosition({...newPosition, source_wallet_id: v})}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner le wallet source..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucun</SelectItem>
                        {wallets.map(w => (
                          <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {newPosition.source_wallet_id && newPosition.source_wallet_id !== "none" && (
                    <div className="flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        id="create_withdrawal_tx"
                        checked={newPosition.create_withdrawal_tx}
                        onChange={(e) => setNewPosition({...newPosition, create_withdrawal_tx: e.target.checked})}
                        className="rounded"
                      />
                      <Label htmlFor="create_withdrawal_tx" className="text-sm cursor-pointer">
                        Créer automatiquement une transaction de retrait dans le wallet
                      </Label>
                    </div>
                  )}
                </div>
              </div>
              
              <Button onClick={handleCreatePosition} className="w-full" data-testid="submit-position-btn">Créer la Position</Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-blue-500/20">
                <PiggyBank size={24} className="text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Capital Investi</p>
                <p className="text-2xl font-bold">{(globalTotals.total_invested || 0).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Restant: {(globalTotals.remaining_capital || 0).toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-green-500/20">
                <TrendingUp size={24} className="text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Rendement Réalisé</p>
                <p className="text-2xl font-bold text-green-400">+{(globalTotals.total_realized_yield || 0).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Estimé: +{(globalTotals.total_estimated_earnings || 0).toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-amber-500/20">
                <DollarSign size={24} className="text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Capital Retiré</p>
                <p className="text-2xl font-bold text-amber-400">{(globalTotals.total_capital_withdrawn || 0).toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-red-500/20">
                <AlertTriangle size={24} className="text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pertes</p>
                <p className="text-2xl font-bold text-red-400">{(globalTotals.total_loss || 0).toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Totals by Asset */}
      {Object.keys(totalsByAsset).length > 0 && (
        <Card className="mb-6">
          <CardHeader><CardTitle className="card-title-sm">Totaux par Asset</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {Object.entries(totalsByAsset).map(([asset, data]) => (
                <div key={asset} className="p-3 bg-zinc-800/50 rounded-lg min-w-[150px]">
                  <span className="font-bold text-lg">{asset}</span>
                  <p className="text-sm text-muted-foreground">Investi: {data.amount?.toFixed(2)}</p>
                  <p className="text-sm text-green-400">Réalisé: +{(data.realized_yield || 0).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Estimé: +{data.estimated_earnings?.toFixed(2)}</p>
                  {data.total_loss > 0 && <p className="text-sm text-red-400">Pertes: -{data.total_loss.toFixed(2)}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Positions Table */}
      <Card>
        <CardHeader><CardTitle className="card-title-sm">Vos Positions</CardTitle></CardHeader>
        <CardContent>
          {positions.length > 0 ? (
            <ScrollArea className="h-[450px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plateforme</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Asset</TableHead>
                    <TableHead className="text-right">Capital</TableHead>
                    <TableHead className="text-right">APY</TableHead>
                    <TableHead className="text-right text-green-400">Réalisé</TableHead>
                    <TableHead className="text-right">En Attente</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((pos) => (
                    <TableRow key={pos.id} className={`text-zinc-100 ${pos.status === "loss" ? "bg-red-500/10" : pos.status === "closed" ? "bg-zinc-500/10" : ""}`}>
                      <TableCell className="font-medium text-zinc-100">{pos.platform}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getProductTypeLabel(pos.product_type)}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-zinc-100">{pos.asset}</TableCell>
                      <TableCell className="text-right font-mono text-zinc-100">
                        <div>{pos.amount?.toFixed(2)}</div>
                        {pos.capital_withdrawn > 0 && (
                          <div className="text-xs text-amber-400">-{pos.capital_withdrawn.toFixed(2)} retiré</div>
                        )}
                        {pos.total_loss > 0 && (
                          <div className="text-xs text-red-400">-{pos.total_loss.toFixed(2)} perte</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-zinc-100">{pos.apy}%</TableCell>
                      <TableCell className="text-right text-green-400 font-mono">
                        +{(pos.realized_yield || 0).toFixed(2)}
                        {pos.movements_count > 0 && (
                          <div className="text-xs text-muted-foreground">({pos.movements_count} mvts)</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        +{(pos.pending_yield || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {pos.status === "loss" ? (
                          <div className="flex items-center gap-1 text-red-400">
                            <AlertTriangle size={14} />
                            <span className="text-xs">Perte</span>
                          </div>
                        ) : pos.status === "closed" ? (
                          <div className="flex items-center gap-1 text-zinc-400">
                            <Check size={14} />
                            <span className="text-xs">Clôturé</span>
                          </div>
                        ) : pos.is_locked ? (
                          <div className="flex items-center gap-1 text-amber-400">
                            <Lock size={14} />
                            <span className="text-xs">{pos.days_until_unlock}j</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-green-400">
                            <Check size={14} />
                            <span className="text-xs">Actif</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-green-400 hover:text-green-300"
                            onClick={() => openMovementDialog(pos)}
                            title="Ajouter Mouvement"
                          >
                            <Plus size={14} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-purple-400 hover:text-purple-300"
                            onClick={() => viewMovements(pos)}
                            title="Voir Mouvements"
                          >
                            <FileText size={14} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className={`h-7 w-7 ${pos.rule_enabled ? 'text-yellow-400 hover:text-yellow-300' : 'text-gray-400 hover:text-gray-300'}`}
                            onClick={() => openRulesDialog(pos)}
                            title="Règles d'affectation"
                          >
                            <Settings size={14} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-blue-400 hover:text-blue-300"
                            onClick={() => openEditDialog(pos)}
                            title="Modifier"
                          >
                            <Edit2 size={14} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-7 w-7 text-red-400 hover:text-red-300"
                            onClick={() => handleDeletePosition(pos.id)}
                            title="Supprimer"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="empty-state">
              <PiggyBank size={48} className="empty-icon" />
              <h3>Aucune position</h3>
              <p>Ajoutez vos investissements en épargne, vault ou stratégie</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Ajouter Mouvement */}
      <Dialog open={movementDialogOpen} onOpenChange={setMovementDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un Mouvement</DialogTitle>
            {selectedPositionForMovement && (
              <p className="text-sm text-muted-foreground">
                {selectedPositionForMovement.platform} - {selectedPositionForMovement.asset}
              </p>
            )}
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Type de Mouvement</Label>
              <Select value={newMovement.movement_type} onValueChange={(v) => setNewMovement({...newMovement, movement_type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {movementTypes.map(mt => (
                    <SelectItem key={mt.value} value={mt.value}>
                      <span className={mt.color}>{mt.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Montant</Label>
                <Input 
                  type="number" 
                  step="0.01"
                  value={newMovement.amount} 
                  onChange={(e) => setNewMovement({...newMovement, amount: parseFloat(e.target.value) || 0})}
                />
              </div>
              <div>
                <Label>Asset</Label>
                <Select value={newMovement.asset} onValueChange={(v) => setNewMovement({...newMovement, asset: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {assets.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label>Date</Label>
              <Input 
                type="date" 
                value={newMovement.date} 
                onChange={(e) => setNewMovement({...newMovement, date: e.target.value})}
              />
            </div>
            
            <div>
              <Label>Hash Transaction (optionnel)</Label>
              <Input 
                value={newMovement.tx_hash} 
                onChange={(e) => setNewMovement({...newMovement, tx_hash: e.target.value})}
                placeholder="0x..."
                className="font-mono text-xs"
              />
            </div>
            
            <div>
              <Label>Notes</Label>
              <Input 
                value={newMovement.notes} 
                onChange={(e) => setNewMovement({...newMovement, notes: e.target.value})}
                placeholder="Notes optionnelles..."
              />
            </div>
            
            {/* Interdépendance: Wallet pour les mouvements de capital et rendements */}
            {(newMovement.movement_type === "yield_realized" || newMovement.movement_type === "capital_withdrawal" || newMovement.movement_type === "capital_addition") && (
              <div className="border-t pt-4 mt-2">
                <Label className="text-sm text-muted-foreground mb-2 block">Interdépendance (optionnel)</Label>
                <div className="space-y-3">
                  <div>
                    <Label>{newMovement.movement_type === "capital_addition" ? "Wallet Source" : "Wallet Destinataire"}</Label>
                    <Select value={newMovement.target_wallet_id} onValueChange={(v) => setNewMovement({...newMovement, target_wallet_id: v})}>
                      <SelectTrigger><SelectValue placeholder={newMovement.movement_type === "capital_addition" ? "Sélectionner le wallet source..." : "Sélectionner le wallet destinataire..."} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucun</SelectItem>
                        {wallets.map(w => (
                          <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {newMovement.target_wallet_id && newMovement.target_wallet_id !== "none" && (
                    <div className="flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        id="create_deposit_tx"
                        checked={newMovement.create_deposit_tx}
                        onChange={(e) => setNewMovement({...newMovement, create_deposit_tx: e.target.checked})}
                        className="rounded"
                      />
                      <Label htmlFor="create_deposit_tx" className="text-sm cursor-pointer">
                        Créer automatiquement une transaction de dépôt dans le wallet
                      </Label>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <Button onClick={handleCreateMovement} className="w-full">Enregistrer le Mouvement</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Voir Mouvements */}
      <Dialog open={movementsDialogOpen} onOpenChange={setMovementsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex justify-between items-center">
              <span>Historique des Mouvements</span>
              {selectedPositionMovements.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleExportMovementsCSV(selectedPositionForMovement?.id)}
                >
                  <Download size={14} className="mr-2" />
                  Export CSV
                </Button>
              )}
            </DialogTitle>
            {selectedPositionForMovement && (
              <p className="text-sm text-muted-foreground">
                {selectedPositionForMovement.platform} - {selectedPositionForMovement.product_type} - {selectedPositionForMovement.asset}
              </p>
            )}
          </DialogHeader>
          {selectedPositionMovements.length > 0 ? (
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Asset</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-[60px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedPositionMovements.map((mov) => (
                    <TableRow key={mov.id} className="text-zinc-100">
                      <TableCell className="text-sm text-zinc-100">{new Date(mov.date).toLocaleDateString("fr-FR")}</TableCell>
                      <TableCell>
                        <span className={getMovementTypeColor(mov.movement_type)}>
                          {getMovementTypeLabel(mov.movement_type)}
                        </span>
                      </TableCell>
                      <TableCell className={`text-right font-mono ${
                        mov.movement_type === "impermanent_loss" ? "text-red-400" : 
                        mov.movement_type === "capital_withdrawal" ? "text-amber-400" :
                        mov.movement_type === "capital_addition" ? "text-blue-400" :
                        "text-green-400"
                      }`}>
                        {mov.movement_type === "impermanent_loss" ? "-" : 
                         mov.movement_type === "capital_withdrawal" ? "-" : "+"}{mov.amount?.toFixed(2)}
                      </TableCell>
                      <TableCell className="font-mono text-zinc-100">{mov.asset}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{mov.notes || "-"}</TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-7 w-7 text-red-400 hover:text-red-300"
                          onClick={() => handleDeleteMovement(mov.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Aucun mouvement enregistré pour cette position
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Modifier la Position</DialogTitle></DialogHeader>
          {editingPosition && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Plateforme</Label>
                  <Select value={editingPosition.platform} onValueChange={(v) => setEditingPosition({...editingPosition, platform: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {platforms.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Type de Produit</Label>
                  <Select value={editingPosition.product_type} onValueChange={(v) => setEditingPosition({...editingPosition, product_type: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {productTypes.map(pt => <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Asset</Label>
                  <Select value={editingPosition.asset} onValueChange={(v) => setEditingPosition({...editingPosition, asset: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {assets.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Montant</Label>
                  <Input 
                    type="number" 
                    value={editingPosition.amount} 
                    onChange={(e) => setEditingPosition({...editingPosition, amount: parseFloat(e.target.value) || 0})}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>APY (%)</Label>
                  <Input 
                    type="number" 
                    step="0.1"
                    value={editingPosition.apy} 
                    onChange={(e) => setEditingPosition({...editingPosition, apy: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <Label>Date de Dépôt</Label>
                  <Input 
                    type="date" 
                    value={editingPosition.deposit_date} 
                    onChange={(e) => setEditingPosition({...editingPosition, deposit_date: e.target.value})}
                  />
                </div>
              </div>
              
              <div>
                <Label>Date de Déblocage (optionnel)</Label>
                <Input 
                  type="date" 
                  value={editingPosition.unlock_date || ""} 
                  onChange={(e) => setEditingPosition({...editingPosition, unlock_date: e.target.value})}
                />
              </div>
              
              <div>
                <Label>Notes</Label>
                <Input 
                  value={editingPosition.notes || ""} 
                  onChange={(e) => setEditingPosition({...editingPosition, notes: e.target.value})}
                />
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="flex-1">Annuler</Button>
                <Button onClick={handleUpdatePosition} className="flex-1">Enregistrer</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Rules Dialog */}
      <Dialog open={rulesDialogOpen} onOpenChange={setRulesDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Règles d'Affectation Automatique</DialogTitle>
          </DialogHeader>
          {selectedPositionForRules && (
            <div className="space-y-4">
              <div className="p-3 bg-zinc-800 rounded-lg">
                <p className="text-sm text-zinc-400">Position: <span className="text-white font-medium">{selectedPositionForRules.platform} - {selectedPositionForRules.product_type}</span></p>
                <p className="text-sm text-zinc-400">Asset: <span className="text-white">{selectedPositionForRules.asset}</span></p>
              </div>
              
              <div className="space-y-3">
                <div>
                  <Label>Adresse de contrepartie (partielle ou complète)</Label>
                  <Input 
                    value={selectedPositionForRules.rule_address || ""}
                    onChange={(e) => setSelectedPositionForRules({...selectedPositionForRules, rule_address: e.target.value})}
                    placeholder="0x1234... ou partie de l'adresse"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-zinc-500 mt-1">Les transactions avec cette adresse seront matchées</p>
                </div>
                
                <div>
                  <Label>Asset à matcher</Label>
                  <Input 
                    value={selectedPositionForRules.rule_asset || ""}
                    onChange={(e) => setSelectedPositionForRules({...selectedPositionForRules, rule_asset: e.target.value})}
                    placeholder="EURA, USDC, 8LNDS..."
                  />
                  <p className="text-xs text-zinc-500 mt-1">Les transactions avec cet asset seront matchées</p>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input 
                    type="checkbox"
                    id="rule_enabled"
                    checked={selectedPositionForRules.rule_enabled || false}
                    onChange={(e) => setSelectedPositionForRules({...selectedPositionForRules, rule_enabled: e.target.checked})}
                    className="rounded"
                  />
                  <Label htmlFor="rule_enabled" className="cursor-pointer">Activer les règles d'affectation</Label>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => handleUpdateRules(
                    selectedPositionForRules.rule_address,
                    selectedPositionForRules.rule_asset,
                    selectedPositionForRules.rule_enabled
                  )}
                  className="flex-1"
                >
                  Sauvegarder les règles
                </Button>
                <Button 
                  variant="outline"
                  onClick={handlePreviewRules}
                  className="flex-1"
                >
                  <Eye size={16} className="mr-2" />
                  Prévisualiser
                </Button>
              </div>
              
              {previewResults && (
                <div className="border rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium">{previewResults.count} transaction(s) trouvée(s)</p>
                  {previewResults.matching_transactions?.length > 0 && (
                    <ScrollArea className="h-48">
                      <div className="space-y-1">
                        {previewResults.matching_transactions.slice(0, 20).map((tx, idx) => (
                          <div key={idx} className="text-xs p-2 bg-zinc-800 rounded flex justify-between">
                            <span className="text-zinc-400">{tx.date?.split("T")[0]}</span>
                            <span className={tx.type === "Transfer Out" ? "text-red-400" : "text-green-400"}>{tx.type}</span>
                            <span className="text-white">{tx.amount} {tx.asset}</span>
                            <span className="text-zinc-500 truncate max-w-[150px]">{tx.counterparty_wallet || tx.wallet_name}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              )}
              
              <Button 
                onClick={handleApplyRules}
                disabled={!selectedPositionForRules.rule_enabled || applyingRules}
                className="w-full"
              >
                {applyingRules ? "Application en cours..." : "Appliquer les règles maintenant"}
              </Button>
              
              <p className="text-xs text-zinc-500 text-center">
                Les Transfer Out seront convertis en "Dépôt Capital" et les Transfer In en "Rendement Réalisé"
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ==================== FIAT PAGE ====================

const FiatPage = () => {
  const { accessToken } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [newAccount, setNewAccount] = useState({ name: "", currency: "EUR", initial_balance: 0 });
  const [newTransaction, setNewTransaction] = useState({ 
    type: "deposit", 
    amount: 0, 
    description: "",
    date: new Date().toISOString().split("T")[0],
    time: new Date().toTimeString().slice(0, 5),
    // Source
    source_type: "external",
    source_account_id: "",
    source_wallet_id: "",
    source_wallet_address: "",
    // Destination
    dest_type: "bank",
    dest_account_id: "",
    dest_wallet_id: "",
    dest_wallet_address: "",
    // Crypto conversion (for crypto_buy/crypto_sell)
    crypto_asset: "EURC",
    crypto_amount: 0
  });

  const api = createAuthenticatedApi(accessToken);

  const fetchAccounts = async () => {
    try {
      const response = await api.get("/fiat-accounts");
      setAccounts(response.data);
      if (response.data.length > 0 && !selectedAccount) {
        setSelectedAccount(response.data[0]);
      }
    } catch (error) {
      toast.error("Erreur lors du chargement des comptes");
    } finally {
      setLoading(false);
    }
  };

  const fetchWallets = async () => {
    try {
      const response = await api.get("/wallets");
      setWallets(response.data);
    } catch (error) {
      console.error("Error fetching wallets:", error);
    }
  };

  // Export functions
  const exportFiatAccounts = async () => {
    try {
      const response = await api.get("/export/fiat-accounts", { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'comptes_fiat.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Export des comptes téléchargé");
    } catch (error) {
      toast.error("Erreur lors de l'export");
    }
  };

  const exportFiatTransactions = async () => {
    try {
      const url = selectedAccount 
        ? `/export/fiat-transactions?account_id=${selectedAccount.id}`
        : "/export/fiat-transactions";
      const response = await api.get(url, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = selectedAccount 
        ? `transactions_${selectedAccount.name.replace(/\s+/g, '_')}.csv`
        : 'transactions_fiat.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
      toast.success("Export des transactions téléchargé");
    } catch (error) {
      toast.error("Erreur lors de l'export");
    }
  };

  const fetchTransactions = async (accountId) => {
    if (!accountId) return;
    try {
      const response = await api.get("/fiat-transactions", { params: { account_id: accountId } });
      setTransactions(response.data.transactions || []);
    } catch (error) {
      console.error("Error fetching fiat transactions:", error);
    }
  };

  useEffect(() => { fetchAccounts(); fetchWallets(); }, []);
  useEffect(() => { if (selectedAccount) fetchTransactions(selectedAccount.id); }, [selectedAccount]);

  const handleCreateAccount = async () => {
    try {
      await api.post("/fiat-accounts", newAccount);
      toast.success("Compte créé");
      setDialogOpen(false);
      setNewAccount({ name: "", currency: "EUR", initial_balance: 0 });
      fetchAccounts();
    } catch (error) {
      toast.error("Erreur lors de la création");
    }
  };

  const handleDeleteAccount = async (id) => {
    if (window.confirm("Supprimer ce compte ?")) {
      try {
        await api.delete(`/fiat-accounts/${id}`);
        toast.success("Compte supprimé");
        setSelectedAccount(null);
        fetchAccounts();
      } catch (error) {
        toast.error("Erreur lors de la suppression");
      }
    }
  };

  const handleCreateTransaction = async () => {
    if (!selectedAccount) return;
    try {
      // Combine date and time into ISO datetime string
      const dateTime = newTransaction.time 
        ? `${newTransaction.date}T${newTransaction.time}:00`
        : newTransaction.date;
      
      // Adjust amount based on transaction type
      let finalAmount = Math.abs(newTransaction.amount);
      if (["withdrawal", "crypto_buy", "transfer_out"].includes(newTransaction.type)) {
        finalAmount = -finalAmount;
      }
      
      const { time, amount, ...transactionData } = newTransaction;
      
      // Set source/dest based on type
      let source_type = newTransaction.source_type;
      let dest_type = newTransaction.dest_type;
      let source_account_id = newTransaction.source_account_id;
      let dest_account_id = newTransaction.dest_account_id;
      
      // For deposits/crypto_sell: destination is current account
      if (["deposit", "crypto_sell", "transfer_in"].includes(newTransaction.type)) {
        dest_type = "bank";
        dest_account_id = selectedAccount.id;
      }
      // For withdrawals/crypto_buy: source is current account
      if (["withdrawal", "crypto_buy", "transfer_out"].includes(newTransaction.type)) {
        source_type = "bank";
        source_account_id = selectedAccount.id;
      }
      
      // Build request payload
      const payload = { 
        ...transactionData,
        amount: finalAmount,
        date: dateTime,
        account_id: selectedAccount.id,
        source_type,
        source_account_id: source_account_id || null,
        source_wallet_id: newTransaction.source_wallet_id || null,
        source_wallet_address: newTransaction.source_wallet_address || null,
        dest_type,
        dest_account_id: dest_account_id || null,
        dest_wallet_id: newTransaction.dest_wallet_id || null,
        dest_wallet_address: newTransaction.dest_wallet_address || null
      };
      
      // Add crypto conversion fields for crypto_buy/crypto_sell
      if (["crypto_buy", "crypto_sell"].includes(newTransaction.type)) {
        payload.crypto_asset = newTransaction.crypto_asset;
        payload.crypto_amount = newTransaction.crypto_amount;
      }
      
      await api.post("/fiat-transactions", payload);
      toast.success("Transaction ajoutée");
      setTxDialogOpen(false);
      setNewTransaction({ 
        type: "deposit", 
        amount: 0, 
        description: "",
        date: new Date().toISOString().split("T")[0],
        time: new Date().toTimeString().slice(0, 5),
        source_type: "external",
        source_account_id: "",
        source_wallet_id: "",
        source_wallet_address: "",
        dest_type: "bank",
        dest_account_id: "",
        dest_wallet_id: "",
        dest_wallet_address: "",
        crypto_asset: "EURC",
        crypto_amount: 0
      });
      fetchAccounts();
      fetchTransactions(selectedAccount.id);
    } catch (error) {
      toast.error("Erreur lors de la création");
    }
  };

  // Ouvrir le dialog d'édition avec les données de la transaction
  const openEditDialog = (tx) => {
    const txDate = new Date(tx.date);
    setEditingTransaction({
      ...tx,
      date: txDate.toISOString().split("T")[0],
      time: txDate.toTimeString().slice(0, 5),
      amount: Math.abs(tx.amount) // Toujours positif dans le formulaire
    });
    setEditDialogOpen(true);
  };

  // Mettre à jour une transaction
  const handleUpdateTransaction = async () => {
    if (!editingTransaction) return;
    try {
      // Combine date and time
      const dateTime = editingTransaction.time 
        ? `${editingTransaction.date}T${editingTransaction.time}:00`
        : editingTransaction.date;
      
      // Adjust amount based on transaction type
      let finalAmount = Math.abs(editingTransaction.amount);
      if (["withdrawal", "crypto_buy", "transfer_out"].includes(editingTransaction.type)) {
        finalAmount = -finalAmount;
      }
      
      await api.put(`/fiat-transactions/${editingTransaction.id}`, {
        type: editingTransaction.type,
        amount: finalAmount,
        description: editingTransaction.description,
        date: dateTime,
        source_type: editingTransaction.source_type,
        source_account_id: editingTransaction.source_account_id || null,
        source_wallet_id: editingTransaction.source_wallet_id || null,
        source_wallet_address: editingTransaction.source_wallet_address || null,
        dest_type: editingTransaction.dest_type,
        dest_account_id: editingTransaction.dest_account_id || null,
        dest_wallet_id: editingTransaction.dest_wallet_id || null,
        dest_wallet_address: editingTransaction.dest_wallet_address || null
      });
      toast.success("Transaction modifiée");
      setEditDialogOpen(false);
      setEditingTransaction(null);
      fetchAccounts();
      fetchTransactions(selectedAccount.id);
    } catch (error) {
      toast.error("Erreur lors de la modification");
    }
  };

  // Supprimer une transaction
  const handleDeleteTransaction = async (txId) => {
    if (window.confirm("Supprimer cette transaction ? Le solde du compte sera ajusté.")) {
      try {
        await api.delete(`/fiat-transactions/${txId}`);
        toast.success("Transaction supprimée");
        fetchAccounts();
        fetchTransactions(selectedAccount.id);
      } catch (error) {
        toast.error("Erreur lors de la suppression");
      }
    }
  };

  // Determine if we need source or destination input based on transaction type (for edit dialog)
  const editNeedsSourceInput = editingTransaction && ["deposit", "crypto_sell", "transfer_in"].includes(editingTransaction.type);
  const editNeedsDestInput = editingTransaction && ["withdrawal", "crypto_buy", "transfer_out"].includes(editingTransaction.type);

  // Determine if we need source or destination input based on transaction type
  // Exclude crypto_buy/crypto_sell as they have their own dedicated section
  const needsSourceInput = ["deposit", "transfer_in"].includes(newTransaction.type);
  const needsDestInput = ["withdrawal", "transfer_out"].includes(newTransaction.type);

  return (
    <div className="page-content" data-testid="fiat-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Comptes Fiat</h1>
          <p className="page-subtitle">Gérez vos comptes bancaires</p>
        </div>
        <div className="header-actions">
          <Button variant="outline" onClick={exportFiatAccounts}>
            <Download size={16} className="mr-2" />
            Export Comptes
          </Button>
          <Button variant="outline" onClick={exportFiatTransactions}>
            <Download size={16} className="mr-2" />
            Export Transactions
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus size={16} className="mr-2" />Ajouter Compte</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Ajouter un Compte Fiat</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Nom</Label><Input value={newAccount.name} onChange={(e) => setNewAccount({...newAccount, name: e.target.value})} placeholder="Ma Banque" /></div>
                <div><Label>Devise</Label>
                  <Select value={newAccount.currency} onValueChange={(v) => setNewAccount({...newAccount, currency: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="CHF">CHF</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Solde Initial</Label><Input type="number" value={newAccount.initial_balance} onChange={(e) => setNewAccount({...newAccount, initial_balance: parseFloat(e.target.value) || 0})} /></div>
                <Button onClick={handleCreateAccount} className="w-full">Créer le Compte</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="fiat-layout">
        <div className="accounts-list">
          <h3 className="section-title">Vos Comptes</h3>
          {accounts.map((account) => (
            <div key={account.id} className={`account-item ${selectedAccount?.id === account.id ? 'active' : ''}`} onClick={() => setSelectedAccount(account)}>
              <div className="account-icon"><DollarSign size={20} /></div>
              <div className="account-info"><span className="account-name">{account.name}</span><span className="account-currency">{account.currency}</span></div>
              <span className="account-balance">{account.balance.toFixed(2)}</span>
            </div>
          ))}
          {accounts.length === 0 && <div className="empty-state-sm"><p>Aucun compte</p></div>}
        </div>

        <div className="account-details">
          {selectedAccount ? (
            <>
              <Card className="balance-card">
                <CardContent className="pt-6">
                  <div className="balance-header">
                    <span className="balance-label">Solde</span>
                    <div className="balance-actions">
                      <Dialog open={txDialogOpen} onOpenChange={setTxDialogOpen}>
                        <DialogTrigger asChild><Button size="sm"><Plus size={14} className="mr-1" />Nouvelle Transaction</Button></DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <DialogHeader><DialogTitle>Ajouter une Transaction Fiat</DialogTitle></DialogHeader>
                          <div className="space-y-4">
                            {/* Type de transaction */}
                            <div>
                              <Label>Type de Transaction</Label>
                              <Select value={newTransaction.type} onValueChange={(v) => setNewTransaction({...newTransaction, type: v})}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="deposit">Dépôt (Entrée)</SelectItem>
                                  <SelectItem value="withdrawal">Retrait (Sortie)</SelectItem>
                                  <SelectItem value="crypto_buy">Achat Crypto</SelectItem>
                                  <SelectItem value="crypto_sell">Vente Crypto</SelectItem>
                                  <SelectItem value="transfer_in">Virement Entrant</SelectItem>
                                  <SelectItem value="transfer_out">Virement Sortant</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Montant et Description */}
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Montant ({selectedAccount.currency})</Label>
                                <Input type="number" value={newTransaction.amount} onChange={(e) => setNewTransaction({...newTransaction, amount: parseFloat(e.target.value) || 0})} data-testid="fiat-amount-input" />
                              </div>
                              <div>
                                <Label>Description</Label>
                                <Input value={newTransaction.description} onChange={(e) => setNewTransaction({...newTransaction, description: e.target.value})} data-testid="fiat-description-input" />
                              </div>
                            </div>

                            {/* Crypto Conversion Fields - for crypto_buy/crypto_sell */}
                            {["crypto_buy", "crypto_sell"].includes(newTransaction.type) && (
                              <div className="p-3 bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-lg space-y-3">
                                <Label className="text-purple-400 flex items-center gap-2">
                                  <Wallet size={16} />
                                  {newTransaction.type === "crypto_buy" ? "Crypto Reçue" : "Crypto Vendue"}
                                </Label>
                                
                                {/* Wallet selection */}
                                <div>
                                  <Label className="text-xs text-muted-foreground">
                                    {newTransaction.type === "crypto_buy" ? "Wallet de destination" : "Wallet source"}
                                  </Label>
                                  {wallets.length > 0 ? (
                                    <Select 
                                      value={newTransaction.type === "crypto_buy" ? newTransaction.dest_wallet_id : newTransaction.source_wallet_id} 
                                      onValueChange={(v) => {
                                        const wallet = wallets.find(w => w.id === v);
                                        if (newTransaction.type === "crypto_buy") {
                                          setNewTransaction({...newTransaction, dest_type: "wallet", dest_wallet_id: v, dest_wallet_address: wallet?.address || ""});
                                        } else {
                                          setNewTransaction({...newTransaction, source_type: "wallet", source_wallet_id: v, source_wallet_address: wallet?.address || ""});
                                        }
                                      }}
                                    >
                                      <SelectTrigger><SelectValue placeholder="Sélectionner le wallet" /></SelectTrigger>
                                      <SelectContent>
                                        {wallets.map(w => (
                                          <SelectItem key={w.id} value={w.id}>{w.name} ({w.network})</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <p className="text-sm text-amber-400">Aucun wallet crypto disponible. Créez d'abord un wallet.</p>
                                  )}
                                </div>
                                
                                {/* Crypto asset and amount */}
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Asset crypto</Label>
                                    <Select value={newTransaction.crypto_asset} onValueChange={(v) => setNewTransaction({...newTransaction, crypto_asset: v})}>
                                      <SelectTrigger><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="EURC">EURC (Euro Coin)</SelectItem>
                                        <SelectItem value="EURA">EURA (Angle EUR)</SelectItem>
                                        <SelectItem value="USDC">USDC (USD Coin)</SelectItem>
                                        <SelectItem value="USDT">USDT (Tether)</SelectItem>
                                        <SelectItem value="DAI">DAI</SelectItem>
                                        <SelectItem value="ETH">ETH</SelectItem>
                                        <SelectItem value="BTC">BTC</SelectItem>
                                        <SelectItem value="OTHER">Autre...</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Montant crypto {newTransaction.type === "crypto_buy" ? "reçu" : "vendu"}</Label>
                                    <Input 
                                      type="number" 
                                      step="0.000001"
                                      value={newTransaction.crypto_amount} 
                                      onChange={(e) => setNewTransaction({...newTransaction, crypto_amount: parseFloat(e.target.value) || 0})} 
                                      placeholder="Ex: 100.00"
                                      data-testid="crypto-amount-input"
                                    />
                                  </div>
                                </div>
                                
                                {/* Quick copy from fiat amount */}
                                {newTransaction.amount > 0 && newTransaction.crypto_amount === 0 && (
                                  <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="sm" 
                                    className="text-xs"
                                    onClick={() => setNewTransaction({...newTransaction, crypto_amount: newTransaction.amount})}
                                  >
                                    Copier le montant fiat (1:1)
                                  </Button>
                                )}
                                
                                {/* Summary */}
                                {newTransaction.crypto_amount > 0 && newTransaction.amount > 0 && (
                                  <div className="text-xs text-muted-foreground bg-zinc-800/50 p-2 rounded">
                                    {newTransaction.type === "crypto_buy" ? (
                                      <span>Achat: <strong className="text-red-400">{newTransaction.amount} {selectedAccount.currency}</strong> → <strong className="text-green-400">{newTransaction.crypto_amount} {newTransaction.crypto_asset}</strong></span>
                                    ) : (
                                      <span>Vente: <strong className="text-red-400">{newTransaction.crypto_amount} {newTransaction.crypto_asset}</strong> → <strong className="text-green-400">{newTransaction.amount} {selectedAccount.currency}</strong></span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Source - affiché pour dépôts, ventes crypto, virements entrants */}
                            {needsSourceInput && (
                              <div className="p-3 bg-zinc-800/50 rounded-lg space-y-3">
                                <Label className="text-green-400">Origine (Source)</Label>
                                <Select value={newTransaction.source_type} onValueChange={(v) => setNewTransaction({...newTransaction, source_type: v, source_account_id: "", source_wallet_id: "", source_wallet_address: ""})}>
                                  <SelectTrigger><SelectValue placeholder="Type d'origine" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="external">Externe (Autre)</SelectItem>
                                    <SelectItem value="bank">Compte Fiat</SelectItem>
                                    <SelectItem value="exchange">Exchange (Kraken, Binance...)</SelectItem>
                                    <SelectItem value="wallet">Wallet Crypto</SelectItem>
                                  </SelectContent>
                                </Select>
                                
                                {newTransaction.source_type === "bank" && (
                                  <>
                                    {accounts.filter(a => a.id !== selectedAccount.id).length > 0 ? (
                                      <Select value={newTransaction.source_account_id} onValueChange={(v) => setNewTransaction({...newTransaction, source_account_id: v})}>
                                        <SelectTrigger><SelectValue placeholder="Sélectionner le compte" /></SelectTrigger>
                                        <SelectContent>
                                          {accounts.filter(a => a.id !== selectedAccount.id).map(a => (
                                            <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <p className="text-sm text-amber-400">Vous n'avez qu'un seul compte. Créez un autre compte ou choisissez "Externe".</p>
                                    )}
                                  </>
                                )}
                                
                                {newTransaction.source_type === "wallet" && (
                                  <>
                                    {wallets.length > 0 ? (
                                      <Select value={newTransaction.source_wallet_id} onValueChange={(v) => {
                                        const wallet = wallets.find(w => w.id === v);
                                        setNewTransaction({...newTransaction, source_wallet_id: v, source_wallet_address: wallet?.address || ""});
                                      }}>
                                        <SelectTrigger><SelectValue placeholder="Sélectionner le wallet" /></SelectTrigger>
                                        <SelectContent>
                                          {wallets.map(w => (
                                            <SelectItem key={w.id} value={w.id}>{w.name} ({w.network})</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <p className="text-sm text-amber-400">Aucun wallet disponible. Créez d'abord un wallet.</p>
                                    )}
                                    {newTransaction.source_wallet_id && (
                                      <Input value={newTransaction.source_wallet_address} disabled placeholder="Adresse du wallet" className="font-mono text-xs" />
                                    )}
                                  </>
                                )}
                                
                                {newTransaction.source_type === "external" && (
                                  <Input 
                                    value={newTransaction.source_wallet_address} 
                                    onChange={(e) => setNewTransaction({...newTransaction, source_wallet_address: e.target.value})}
                                    placeholder="Référence ou adresse externe (optionnel)"
                                  />
                                )}
                                
                                {newTransaction.source_type === "exchange" && (
                                  <>
                                    {wallets.filter(w => w.type === "manual" || w.name.toLowerCase().includes("kraken") || w.name.toLowerCase().includes("binance") || w.name.toLowerCase().includes("coinbase")).length > 0 && (
                                      <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Sélectionner un wallet existant (optionnel)</Label>
                                        <Select value={newTransaction.source_wallet_id || ""} onValueChange={(v) => {
                                          const wallet = wallets.find(w => w.id === v);
                                          setNewTransaction({...newTransaction, source_wallet_id: v, source_wallet_address: wallet?.name || ""});
                                        }}>
                                          <SelectTrigger><SelectValue placeholder="Choisir un wallet..." /></SelectTrigger>
                                          <SelectContent>
                                            {wallets.filter(w => w.type === "manual" || w.name.toLowerCase().includes("kraken") || w.name.toLowerCase().includes("binance") || w.name.toLowerCase().includes("coinbase")).map(w => (
                                              <SelectItem key={w.id} value={w.id}>{w.name} ({w.network})</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    )}
                                    <Input 
                                      value={newTransaction.source_wallet_address} 
                                      onChange={(e) => setNewTransaction({...newTransaction, source_wallet_address: e.target.value})}
                                      placeholder="Nom de l'exchange (ex: Kraken, Binance...)"
                                    />
                                  </>
                                )}
                              </div>
                            )}

                            {/* Destination - affiché pour retraits, achats crypto, virements sortants */}
                            {needsDestInput && (
                              <div className="p-3 bg-zinc-800/50 rounded-lg space-y-3">
                                <Label className="text-red-400">Destination</Label>
                                <Select value={newTransaction.dest_type} onValueChange={(v) => setNewTransaction({...newTransaction, dest_type: v, dest_account_id: "", dest_wallet_id: "", dest_wallet_address: ""})}>
                                  <SelectTrigger><SelectValue placeholder="Type de destination" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="external">Externe (Autre)</SelectItem>
                                    <SelectItem value="bank">Compte Fiat</SelectItem>
                                    <SelectItem value="exchange">Exchange (Kraken, Binance...)</SelectItem>
                                    <SelectItem value="wallet">Wallet Crypto</SelectItem>
                                  </SelectContent>
                                </Select>
                                
                                {newTransaction.dest_type === "bank" && (
                                  <>
                                    {accounts.filter(a => a.id !== selectedAccount.id).length > 0 ? (
                                      <Select value={newTransaction.dest_account_id} onValueChange={(v) => setNewTransaction({...newTransaction, dest_account_id: v})}>
                                        <SelectTrigger><SelectValue placeholder="Sélectionner le compte" /></SelectTrigger>
                                        <SelectContent>
                                          {accounts.filter(a => a.id !== selectedAccount.id).map(a => (
                                            <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <p className="text-sm text-amber-400">Vous n'avez qu'un seul compte. Créez un autre compte ou choisissez "Externe".</p>
                                    )}
                                  </>
                                )}
                                
                                {newTransaction.dest_type === "wallet" && (
                                  <>
                                    {wallets.length > 0 ? (
                                      <Select value={newTransaction.dest_wallet_id} onValueChange={(v) => {
                                        const wallet = wallets.find(w => w.id === v);
                                        setNewTransaction({...newTransaction, dest_wallet_id: v, dest_wallet_address: wallet?.address || ""});
                                      }}>
                                        <SelectTrigger><SelectValue placeholder="Sélectionner le wallet" /></SelectTrigger>
                                        <SelectContent>
                                          {wallets.map(w => (
                                            <SelectItem key={w.id} value={w.id}>{w.name} ({w.network})</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <p className="text-sm text-amber-400">Aucun wallet disponible. Créez d'abord un wallet.</p>
                                    )}
                                    {newTransaction.dest_wallet_id && (
                                      <Input value={newTransaction.dest_wallet_address} disabled placeholder="Adresse du wallet" className="font-mono text-xs" />
                                    )}
                                  </>
                                )}
                                
                                {newTransaction.dest_type === "external" && (
                                  <Input 
                                    value={newTransaction.dest_wallet_address} 
                                    onChange={(e) => setNewTransaction({...newTransaction, dest_wallet_address: e.target.value})}
                                    placeholder="Référence ou adresse externe (optionnel)"
                                  />
                                )}
                                
                                {newTransaction.dest_type === "exchange" && (
                                  <>
                                    {/* Liste des wallets de type exchange/manual */}
                                    {wallets.filter(w => w.type === "manual" || w.name.toLowerCase().includes("kraken") || w.name.toLowerCase().includes("binance") || w.name.toLowerCase().includes("coinbase")).length > 0 && (
                                      <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Sélectionner un wallet existant (optionnel)</Label>
                                        <Select value={newTransaction.dest_wallet_id || ""} onValueChange={(v) => {
                                          const wallet = wallets.find(w => w.id === v);
                                          setNewTransaction({...newTransaction, dest_wallet_id: v, dest_wallet_address: wallet?.name || ""});
                                        }}>
                                          <SelectTrigger><SelectValue placeholder="Choisir un wallet..." /></SelectTrigger>
                                          <SelectContent>
                                            {wallets.filter(w => w.type === "manual" || w.name.toLowerCase().includes("kraken") || w.name.toLowerCase().includes("binance") || w.name.toLowerCase().includes("coinbase")).map(w => (
                                              <SelectItem key={w.id} value={w.id}>{w.name} ({w.network})</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    )}
                                    <Input 
                                      value={newTransaction.dest_wallet_address} 
                                      onChange={(e) => setNewTransaction({...newTransaction, dest_wallet_address: e.target.value})}
                                      placeholder="Nom de l'exchange (ex: Kraken, Binance...)"
                                    />
                                  </>
                                )}
                              </div>
                            )}

                            {/* Date et Heure */}
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Date</Label>
                                <Input 
                                  type="date" 
                                  value={newTransaction.date} 
                                  onChange={(e) => setNewTransaction({...newTransaction, date: e.target.value})}
                                  data-testid="fiat-date-input"
                                />
                              </div>
                              <div>
                                <Label>Heure</Label>
                                <Input 
                                  type="time" 
                                  value={newTransaction.time} 
                                  onChange={(e) => setNewTransaction({...newTransaction, time: e.target.value})}
                                  data-testid="fiat-time-input"
                                />
                              </div>
                            </div>
                            
                            <Button onClick={handleCreateTransaction} className="w-full" data-testid="submit-fiat-transaction-btn">Ajouter la Transaction</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteAccount(selectedAccount.id)}><Trash2 size={14} /></Button>
                    </div>
                  </div>
                  <div className="balance-amount">{selectedAccount.balance.toFixed(2)} <span className="balance-currency">{selectedAccount.currency}</span></div>
                </CardContent>
              </Card>
              
              {/* Tableau comptable Débit/Crédit/Solde */}
              <Card className="history-card">
                <CardHeader><CardTitle className="card-title-sm">Historique des Transactions</CardTitle></CardHeader>
                <CardContent>
                  {transactions.length > 0 ? (
                    <ScrollArea className="h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[100px]">Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Origine</TableHead>
                            <TableHead>Destination</TableHead>
                            <TableHead className="text-right text-red-400">Débit</TableHead>
                            <TableHead className="text-right text-green-400">Crédit</TableHead>
                            <TableHead className="text-right">Solde</TableHead>
                            <TableHead className="w-[80px] text-center">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {transactions.map((tx) => (
                            <TableRow key={tx.id}>
                              <TableCell className="text-xs">
                                {new Date(tx.date).toLocaleDateString("fr-FR")}
                                <br />
                                <span className="text-muted-foreground">{new Date(tx.date).toLocaleTimeString("fr-FR", {hour: '2-digit', minute: '2-digit'})}</span>
                              </TableCell>
                              <TableCell>
                                <Badge variant={tx.amount >= 0 ? "default" : "destructive"} className="text-xs">
                                  {tx.type === "deposit" ? "Dépôt" :
                                   tx.type === "withdrawal" ? "Retrait" :
                                   tx.type === "crypto_buy" ? "Achat Crypto" :
                                   tx.type === "crypto_sell" ? "Vente Crypto" :
                                   tx.type === "transfer_in" ? "Virement +" :
                                   tx.type === "transfer_out" ? "Virement -" : tx.type}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-[150px] truncate text-sm">{tx.description || "-"}</TableCell>
                              <TableCell className="text-xs">
                                {tx.source_name ? (
                                  <div className="flex items-center gap-1">
                                    {tx.source_type === "bank" ? <DollarSign size={12} className="text-blue-400" /> : 
                                     tx.source_type === "wallet" ? <Wallet size={12} className="text-purple-400" /> : null}
                                    <span className="truncate max-w-[100px]">{tx.source_name}</span>
                                  </div>
                                ) : tx.source_wallet_address ? (
                                  <span className="font-mono text-xs truncate max-w-[100px]">{tx.source_wallet_address.substring(0, 10)}...</span>
                                ) : "-"}
                              </TableCell>
                              <TableCell className="text-xs">
                                {tx.dest_name ? (
                                  <div className="flex items-center gap-1">
                                    {tx.dest_type === "bank" ? <DollarSign size={12} className="text-blue-400" /> : 
                                     tx.dest_type === "wallet" ? <Wallet size={12} className="text-purple-400" /> : null}
                                    <span className="truncate max-w-[100px]">{tx.dest_name}</span>
                                  </div>
                                ) : tx.dest_wallet_address ? (
                                  <span className="font-mono text-xs truncate max-w-[100px]">{tx.dest_wallet_address.substring(0, 10)}...</span>
                                ) : "-"}
                              </TableCell>
                              <TableCell className="text-right text-red-400 font-mono">
                                {tx.debit > 0 ? tx.debit.toFixed(2) : "-"}
                              </TableCell>
                              <TableCell className="text-right text-green-400 font-mono">
                                {tx.credit > 0 ? tx.credit.toFixed(2) : "-"}
                              </TableCell>
                              <TableCell className="text-right font-mono font-medium">
                                {tx.running_balance?.toFixed(2) || "-"}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-7 w-7 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                                    onClick={() => openEditDialog(tx)}
                                    data-testid={`edit-tx-${tx.id}`}
                                    title="Modifier"
                                  >
                                    <Edit2 size={14} />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                    onClick={() => handleDeleteTransaction(tx.id)}
                                    data-testid={`delete-tx-${tx.id}`}
                                    title="Supprimer"
                                  >
                                    <Trash2 size={14} />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  ) : <div className="empty-state-sm"><p>Aucune transaction</p></div>}
                </CardContent>
              </Card>

              {/* Dialog d'édition de transaction */}
              <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>Modifier la Transaction</DialogTitle></DialogHeader>
                  {editingTransaction && (
                    <div className="space-y-4">
                      {/* Type de transaction */}
                      <div>
                        <Label>Type de Transaction</Label>
                        <Select value={editingTransaction.type} onValueChange={(v) => setEditingTransaction({...editingTransaction, type: v})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="deposit">Dépôt (Entrée)</SelectItem>
                            <SelectItem value="withdrawal">Retrait (Sortie)</SelectItem>
                            <SelectItem value="crypto_buy">Achat Crypto</SelectItem>
                            <SelectItem value="crypto_sell">Vente Crypto</SelectItem>
                            <SelectItem value="transfer_in">Virement Entrant</SelectItem>
                            <SelectItem value="transfer_out">Virement Sortant</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Montant et Description */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Montant ({selectedAccount?.currency || "EUR"})</Label>
                          <Input 
                            type="number" 
                            value={editingTransaction.amount} 
                            onChange={(e) => setEditingTransaction({...editingTransaction, amount: parseFloat(e.target.value) || 0})} 
                            data-testid="edit-fiat-amount-input"
                          />
                        </div>
                        <div>
                          <Label>Description</Label>
                          <Input 
                            value={editingTransaction.description} 
                            onChange={(e) => setEditingTransaction({...editingTransaction, description: e.target.value})} 
                            data-testid="edit-fiat-description-input"
                          />
                        </div>
                      </div>

                      {/* Source - affiché pour dépôts, ventes crypto, virements entrants */}
                      {editNeedsSourceInput && (
                        <div className="p-3 bg-zinc-800/50 rounded-lg space-y-3">
                          <Label className="text-green-400">Origine (Source)</Label>
                          <Select value={editingTransaction.source_type || "external"} onValueChange={(v) => setEditingTransaction({...editingTransaction, source_type: v, source_account_id: "", source_wallet_id: "", source_wallet_address: ""})}>
                            <SelectTrigger><SelectValue placeholder="Type d'origine" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="external">Externe (Autre)</SelectItem>
                              <SelectItem value="bank">Compte Fiat</SelectItem>
                              <SelectItem value="exchange">Exchange (Kraken, Binance...)</SelectItem>
                              <SelectItem value="wallet">Wallet Crypto</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          {editingTransaction.source_type === "bank" && (
                            <Select value={editingTransaction.source_account_id || ""} onValueChange={(v) => setEditingTransaction({...editingTransaction, source_account_id: v})}>
                              <SelectTrigger><SelectValue placeholder="Sélectionner le compte" /></SelectTrigger>
                              <SelectContent>
                                {accounts.filter(a => a.id !== selectedAccount?.id).map(a => (
                                  <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          
                          {editingTransaction.source_type === "wallet" && (
                            <>
                              <Select value={editingTransaction.source_wallet_id || ""} onValueChange={(v) => {
                                const wallet = wallets.find(w => w.id === v);
                                setEditingTransaction({...editingTransaction, source_wallet_id: v, source_wallet_address: wallet?.address || ""});
                              }}>
                                <SelectTrigger><SelectValue placeholder="Sélectionner le wallet" /></SelectTrigger>
                                <SelectContent>
                                  {wallets.map(w => (
                                    <SelectItem key={w.id} value={w.id}>{w.name} ({w.network})</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </>
                          )}
                          
                          {editingTransaction.source_type === "external" && (
                            <Input 
                              value={editingTransaction.source_wallet_address || ""} 
                              onChange={(e) => setEditingTransaction({...editingTransaction, source_wallet_address: e.target.value})}
                              placeholder="Référence ou adresse externe (optionnel)"
                            />
                          )}
                          
                          {editingTransaction.source_type === "exchange" && (
                            <Input 
                              value={editingTransaction.source_wallet_address || ""} 
                              onChange={(e) => setEditingTransaction({...editingTransaction, source_wallet_address: e.target.value})}
                              placeholder="Nom de l'exchange (ex: Kraken, Binance...)"
                            />
                          )}
                        </div>
                      )}

                      {/* Destination - affiché pour retraits, achats crypto, virements sortants */}
                      {editNeedsDestInput && (
                        <div className="p-3 bg-zinc-800/50 rounded-lg space-y-3">
                          <Label className="text-red-400">Destination</Label>
                          <Select value={editingTransaction.dest_type || "external"} onValueChange={(v) => setEditingTransaction({...editingTransaction, dest_type: v, dest_account_id: "", dest_wallet_id: "", dest_wallet_address: ""})}>
                            <SelectTrigger><SelectValue placeholder="Type de destination" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="external">Externe (Autre)</SelectItem>
                              <SelectItem value="bank">Compte Fiat</SelectItem>
                              <SelectItem value="exchange">Exchange (Kraken, Binance...)</SelectItem>
                              <SelectItem value="wallet">Wallet Crypto</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          {editingTransaction.dest_type === "bank" && (
                            <Select value={editingTransaction.dest_account_id || ""} onValueChange={(v) => setEditingTransaction({...editingTransaction, dest_account_id: v})}>
                              <SelectTrigger><SelectValue placeholder="Sélectionner le compte" /></SelectTrigger>
                              <SelectContent>
                                {accounts.filter(a => a.id !== selectedAccount?.id).map(a => (
                                  <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          
                          {editingTransaction.dest_type === "wallet" && (
                            <>
                              <Select value={editingTransaction.dest_wallet_id || ""} onValueChange={(v) => {
                                const wallet = wallets.find(w => w.id === v);
                                setEditingTransaction({...editingTransaction, dest_wallet_id: v, dest_wallet_address: wallet?.address || ""});
                              }}>
                                <SelectTrigger><SelectValue placeholder="Sélectionner le wallet" /></SelectTrigger>
                                <SelectContent>
                                  {wallets.map(w => (
                                    <SelectItem key={w.id} value={w.id}>{w.name} ({w.network})</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </>
                          )}
                          
                          {editingTransaction.dest_type === "external" && (
                            <Input 
                              value={editingTransaction.dest_wallet_address || ""} 
                              onChange={(e) => setEditingTransaction({...editingTransaction, dest_wallet_address: e.target.value})}
                              placeholder="Référence ou adresse externe (optionnel)"
                            />
                          )}
                          
                          {editingTransaction.dest_type === "exchange" && (
                            <Input 
                              value={editingTransaction.dest_wallet_address || ""} 
                              onChange={(e) => setEditingTransaction({...editingTransaction, dest_wallet_address: e.target.value})}
                              placeholder="Nom de l'exchange (ex: Kraken, Binance...)"
                            />
                          )}
                        </div>
                      )}

                      {/* Date et Heure */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Date</Label>
                          <Input 
                            type="date" 
                            value={editingTransaction.date} 
                            onChange={(e) => setEditingTransaction({...editingTransaction, date: e.target.value})}
                            data-testid="edit-fiat-date-input"
                          />
                        </div>
                        <div>
                          <Label>Heure</Label>
                          <Input 
                            type="time" 
                            value={editingTransaction.time} 
                            onChange={(e) => setEditingTransaction({...editingTransaction, time: e.target.value})}
                            data-testid="edit-fiat-time-input"
                          />
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="flex-1">Annuler</Button>
                        <Button onClick={handleUpdateTransaction} className="flex-1" data-testid="submit-edit-fiat-transaction-btn">Enregistrer</Button>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </>
          ) : <div className="empty-state"><DollarSign size={48} className="empty-icon" /><h3>Sélectionnez un compte</h3></div>}
        </div>
      </div>
    </div>
  );
};

// ==================== REPORTS PAGE ====================

const ReportsPage = () => {
  const { accessToken } = useAuth();
  const [pnlData, setPnlData] = useState({ reports: [], summary: {} });
  const [transactions, setTransactions] = useState([]);
  const [positions, setPositions] = useState([]);
  const [fiatAccounts, setFiatAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const api = createAuthenticatedApi(accessToken);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [pnlRes, txRes, posRes, fiatRes] = await Promise.all([
          api.get("/portfolio/pnl"),
          api.get("/transactions", { params: { page_size: 200, hide_spam: true } }),
          api.get("/positions"),
          api.get("/fiat-accounts")
        ]);
        setPnlData(pnlRes.data);
        setTransactions(txRes.data.transactions || []);
        setPositions(posRes.data.positions || []);
        setFiatAccounts(fiatRes.data || []);
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Calculs des statistiques
  const totalFees = transactions.reduce((sum, tx) => sum + (tx.fees || 0), 0);
  const totalTransfersIn = transactions.filter(tx => tx.type === "Transfer In").reduce((sum, tx) => sum + Math.abs(tx.value_eur || 0), 0);
  const totalTransfersOut = transactions.filter(tx => tx.type === "Transfer Out").reduce((sum, tx) => sum + Math.abs(tx.value_eur || 0), 0);
  const totalBuys = transactions.filter(tx => tx.type === "Buy").reduce((sum, tx) => sum + (tx.value_eur || 0), 0);
  const totalSells = transactions.filter(tx => tx.type === "Sell").reduce((sum, tx) => sum + (tx.value_eur || 0), 0);
  
  // Positions
  const totalPositionsCapital = positions.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalPositionsYield = positions.reduce((sum, p) => sum + (p.realized_yield || 0), 0);
  
  // Fiat
  const totalFiatBalance = fiatAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  
  // Top assets par valeur
  const topAssets = [...(pnlData.reports || [])]
    .sort((a, b) => b.current_value_eur - a.current_value_eur)
    .slice(0, 10);

  // Transactions par mois (6 derniers mois)
  const txByMonth = {};
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    txByMonth[key] = { in: 0, out: 0, count: 0 };
  }
  transactions.forEach(tx => {
    const month = tx.date?.substring(0, 7);
    if (txByMonth[month]) {
      txByMonth[month].count++;
      if (tx.type === "Transfer In" || tx.type === "Buy") {
        txByMonth[month].in += Math.abs(tx.value_eur || 0);
      } else {
        txByMonth[month].out += Math.abs(tx.value_eur || 0);
      }
    }
  });

  if (loading) {
    return (
      <div className="page-content flex items-center justify-center">
        <RefreshCw className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="page-content" data-testid="reports-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Rapports</h1>
          <p className="page-subtitle">Analyse complète du portefeuille</p>
        </div>
      </div>
      
      {/* Section P&L */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3 text-zinc-300">Performance (P&L)</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-green-900/30 to-green-800/10 border-green-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-400">P&L Réalisé</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${(pnlData.summary?.total_realized_pnl_eur || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                €{(pnlData.summary?.total_realized_pnl_eur || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-blue-900/30 to-blue-800/10 border-blue-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-400">P&L Non-Réalisé</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${(pnlData.summary?.total_unrealized_pnl_eur || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                €{(pnlData.summary?.total_unrealized_pnl_eur || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-900/30 to-purple-800/10 border-purple-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-400">P&L Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${(pnlData.summary?.total_pnl_eur || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                €{(pnlData.summary?.total_pnl_eur || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-amber-900/30 to-amber-800/10 border-amber-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-400">Total Frais</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-400">
                €{(pnlData.summary?.total_fees_eur || totalFees).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Section Portefeuille */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3 text-zinc-300">Valeur du Portefeuille</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-400">Holdings Crypto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-zinc-100">
                €{(pnlData.summary?.total_holdings_value_eur || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-zinc-500 mt-1">{pnlData.reports?.length || 0} actifs</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-400">Positions (Savings/Lending)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-zinc-100">
                {totalPositionsCapital.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-green-400 mt-1">+{totalPositionsYield.toFixed(2)} rendement</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-400">Comptes Fiat</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-zinc-100">
                €{totalFiatBalance.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-zinc-500 mt-1">{fiatAccounts.length} compte(s)</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Section Activité */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3 text-zinc-300">Activité des Transactions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-400">Entrées (Transfer In)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-green-400">
                €{totalTransfersIn.toLocaleString("fr-FR", { minimumFractionDigits: 0 })}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-400">Sorties (Transfer Out)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-red-400">
                €{totalTransfersOut.toLocaleString("fr-FR", { minimumFractionDigits: 0 })}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-400">Achats (Buy)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-blue-400">
                €{totalBuys.toLocaleString("fr-FR", { minimumFractionDigits: 0 })}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-400">Ventes (Sell)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-orange-400">
                €{totalSells.toLocaleString("fr-FR", { minimumFractionDigits: 0 })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Activité par mois */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3 text-zinc-300">Activité des 6 derniers mois</h2>
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-6 gap-2">
              {Object.entries(txByMonth).map(([month, data]) => (
                <div key={month} className="text-center">
                  <div className="text-xs text-zinc-500 mb-2">{month}</div>
                  <div className="h-24 flex flex-col justify-end items-center gap-1">
                    <div 
                      className="w-8 bg-green-500/60 rounded-t" 
                      style={{ height: `${Math.min(100, (data.in / 10000) * 100)}%`, minHeight: data.in > 0 ? '4px' : '0' }}
                      title={`Entrées: €${data.in.toFixed(0)}`}
                    />
                    <div 
                      className="w-8 bg-red-500/60 rounded-b" 
                      style={{ height: `${Math.min(100, (data.out / 10000) * 100)}%`, minHeight: data.out > 0 ? '4px' : '0' }}
                      title={`Sorties: €${data.out.toFixed(0)}`}
                    />
                  </div>
                  <div className="text-xs text-zinc-400 mt-1">{data.count} tx</div>
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-6 mt-4 text-xs">
              <span className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500/60 rounded" /> Entrées</span>
              <span className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500/60 rounded" /> Sorties</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Assets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold mb-3 text-zinc-300">Top 10 Holdings par Valeur</h2>
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead className="text-right">Valeur EUR</TableHead>
                    <TableHead className="text-right">P&L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topAssets.map((asset) => (
                    <TableRow key={asset.asset} className="text-zinc-100">
                      <TableCell className="font-medium text-zinc-100">{asset.asset}</TableCell>
                      <TableCell className="text-right font-mono text-zinc-100">{asset.current_holdings.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-zinc-100">€{asset.current_value_eur.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className={`text-right font-mono ${asset.realized_pnl_eur >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {asset.realized_pnl_eur >= 0 ? '+' : ''}€{asset.realized_pnl_eur.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Répartition par type de position */}
        <div>
          <h2 className="text-lg font-semibold mb-3 text-zinc-300">Positions par Plateforme</h2>
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plateforme</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Capital</TableHead>
                    <TableHead className="text-right">Rendement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.slice(0, 10).map((pos) => (
                    <TableRow key={pos.id} className="text-zinc-100">
                      <TableCell className="font-medium text-zinc-100">{pos.platform}</TableCell>
                      <TableCell className="text-zinc-100">{pos.product_type}</TableCell>
                      <TableCell className="text-right font-mono text-zinc-100">{pos.amount?.toFixed(2)} {pos.asset}</TableCell>
                      <TableCell className="text-right font-mono text-green-400">+{(pos.realized_yield || 0).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Statistiques */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-3 text-zinc-300">Statistiques Globales</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-zinc-100">{transactions.length}</div>
              <div className="text-sm text-zinc-500">Transactions</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-zinc-100">{pnlData.reports?.length || 0}</div>
              <div className="text-sm text-zinc-500">Actifs Crypto</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-zinc-100">{positions.length}</div>
              <div className="text-sm text-zinc-500">Positions</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-zinc-100">{fiatAccounts.length}</div>
              <div className="text-sm text-zinc-500">Comptes Fiat</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-amber-400">€{totalFees.toFixed(2)}</div>
              <div className="text-sm text-zinc-500">Total Frais</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

// ==================== EXPORT PAGE ====================

const ExportPage = () => {
  const { accessToken } = useAuth();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [exporting, setExporting] = useState(false);
  
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const handleExportCSV = async () => {
    try {
      const response = await fetch(`${API}/export/transactions`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success("Export CSV téléchargé");
      } else {
        toast.error("Erreur lors de l'export CSV");
      }
    } catch (error) {
      toast.error("Erreur lors de l'export CSV");
    }
  };

  const handleExportFiscalPDF = async () => {
    setExporting(true);
    try {
      const response = await fetch(`${API}/export/fiscal-pdf?year=${selectedYear}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rapport_fiscal_crypto_${selectedYear}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success("Rapport fiscal PDF téléchargé");
      } else {
        toast.error("Erreur lors de la génération du PDF");
      }
    } catch (error) {
      toast.error("Erreur lors de l'export");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="page-content" data-testid="export-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Export</h1>
          <p className="page-subtitle">Export your data for tax reporting or backup</p>
        </div>
      </div>
      
      <div className="export-grid">
        <Card className="export-card">
          <CardContent className="pt-6">
            <div className="export-icon">
              <Download size={32} />
            </div>
            <h3 className="export-title">Export Transactions CSV</h3>
            <p className="export-desc">Download all transactions as CSV file</p>
            <Button onClick={handleExportCSV} className="w-full mt-4" data-testid="export-csv-btn">
              <Download size={16} className="mr-2" />
              Download CSV
            </Button>
          </CardContent>
        </Card>
        
        <Card className="export-card export-card-primary">
          <CardContent className="pt-6">
            <div className="export-icon-primary">
              <FileText size={32} />
            </div>
            <h3 className="export-title">Rapport Fiscal PDF</h3>
            <p className="export-desc">Générez un rapport fiscal complet pour vos déclarations</p>
            
            <div className="mt-4 mb-4">
              <Label>Année fiscale</Label>
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button 
              onClick={handleExportFiscalPDF} 
              className="w-full" 
              variant="default"
              disabled={exporting}
              data-testid="export-pdf-btn"
            >
              {exporting ? <RefreshCw size={16} className="mr-2 animate-spin" /> : <FileText size={16} className="mr-2" />}
              {exporting ? "Génération..." : "Télécharger PDF"}
            </Button>
            
            <p className="text-xs text-muted-foreground mt-3 text-center">
              Méthode FIFO • Devise EUR
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// ==================== MAIN APP ====================

const MainLayout = () => {
  const { isCollapsed } = useSidebar();
  
  return (
    <div className="app-layout">
      <Sidebar />
      <main className={`main-content ${isCollapsed ? 'main-content-expanded' : ''}`}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/wallets" element={<WalletsPage />} />
          <Route path="/fiat" element={<FiatPage />} />
          <Route path="/positions" element={<PositionsPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/pnl" element={<PnLPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/export" element={<ExportPage />} />
        </Routes>
      </main>
    </div>
  );
};

const AppContent = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <RefreshCw className="animate-spin" size={32} />
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={
          <ProtectedRoute>
            <SidebarProvider>
              <MainLayout />
            </SidebarProvider>
          </ProtectedRoute>
        } />
      </Routes>
      <Toaster position="top-right" />
    </BrowserRouter>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
