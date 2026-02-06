import React, { useState, useEffect, useCallback, createContext, useContext } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, NavLink, useLocation, Navigate, useNavigate } from "react-router-dom";
import axios from "axios";
import { 
  LayoutDashboard, Wallet, DollarSign, ArrowLeftRight, FileText, Download, 
  Plus, RefreshCw, Trash2, Copy, ChevronLeft, ChevronRight, Upload, LogOut,
  TrendingUp, TrendingDown, User, Lock, Mail, Calculator, Ban, Check,
  Shield, AlertTriangle, Circle, PanelLeftClose, PanelLeft, Edit2
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
    include_fiat: true, // Include fiat transactions by default
    fiat_account_ids: [] // Multi-select for fiat accounts
  });
  const [addressClassifications, setAddressClassifications] = useState({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [csvData, setCsvData] = useState("");
  const [selectedWalletForImport, setSelectedWalletForImport] = useState("");
  const [newTransaction, setNewTransaction] = useState({
    type: "Buy", asset: "USDC", amount: 0, price_usd: 1, price_eur: 0.92,
    value_usd: 0, value_eur: 0, fees: 0, fees_currency: "EUR", wallet_id: "", wallet_name: "",
    source: "manual", 
    date: new Date().toISOString().split("T")[0], 
    time: new Date().toTimeString().slice(0, 5),
    counterparty_wallet: ""
  });
  
  // Address comparison state
  const [compareAddress1, setCompareAddress1] = useState("");
  const [compareAddress2, setCompareAddress2] = useState("");
  
  // Available assets from transactions
  const [availableAssets, setAvailableAssets] = useState(["USDC", "EURC", "ETH", "MATIC", "EUR", "USD", "CHF"]);

  const api = createAuthenticatedApi(accessToken);

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

  const getAddressColor = (address) => {
    if (!address) return "neutral";
    const classification = addressClassifications[address.toLowerCase()];
    return classification || "neutral";
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
      await api.post("/transactions", {
        ...transactionData,
        date: dateTime,
        wallet_name: wallet?.name || "Unknown",
        value_usd: newTransaction.amount * newTransaction.price_usd,
        value_eur: newTransaction.amount * newTransaction.price_eur
      });
      toast.success("Transaction créée");
      setDialogOpen(false);
      // Reset form with current date/time
      setNewTransaction({
        type: "Buy", asset: "USDC", amount: 0, price_usd: 1, price_eur: 0.92,
        value_usd: 0, value_eur: 0, fees: 0, fees_currency: "EUR", wallet_id: "", wallet_name: "",
        source: "manual", 
        date: new Date().toISOString().split("T")[0], 
        time: new Date().toTimeString().slice(0, 5),
        counterparty_wallet: ""
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

  const toggleSpam = async (txId) => {
    try {
      const response = await api.patch(`/transactions/${txId}/spam`);
      toast.success(response.data.message);
      fetchTransactions();
    } catch (error) {
      toast.error("Erreur lors du changement de statut spam");
    }
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
              className="flex-1 font-mono text-xs"
              style={{ maxWidth: '320px' }}
            />
            <Input 
              type="text" 
              placeholder="Adresse 2 (coller ici)" 
              value={compareAddress2}
              onChange={(e) => setCompareAddress2(e.target.value.trim())}
              className="flex-1 font-mono text-xs"
              style={{ maxWidth: '320px' }}
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
                <TableHead>Asset</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Prix/Débit</TableHead>
                <TableHead>Valeur/Crédit</TableHead>
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
                  {/* Source (Wallet/Counterparty for crypto, source_name for fiat) */}
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
                      <span className="wallet-name-cell">{tx.wallet_name}</span>
                    )}
                  </TableCell>
                  {/* Destination (counterparty for crypto, dest_name for fiat) */}
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
                                      {tx.counterparty_wallet.substring(0, 10)}...
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
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : "-"
                    )}
                  </TableCell>
                  <TableCell>{new Date(tx.date).toLocaleDateString("fr-FR")}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
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
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-red-500 hover:text-red-600"
                        onClick={async () => {
                          try {
                            if (tx.tx_category === "fiat") {
                              // Delete fiat transaction would need a different endpoint
                              toast.error("Supprimez les transactions fiat depuis la page Fiat");
                            } else {
                              await api.delete(`/transactions/${tx.id}`);
                              toast.success("Transaction supprimée");
                              fetchTransactions();
                            }
                          } catch (error) {
                            toast.error("Erreur lors de la suppression");
                          }
                        }}
                        title="Supprimer"
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
            <p className="pnl-value text-orange-400">€{(summary.total_fees_eur || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}</p>
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
                <TableRow key={report.asset}>
                  <TableCell className="font-medium">{report.asset}</TableCell>
                  <TableCell>{report.total_bought.toLocaleString()}</TableCell>
                  <TableCell>{report.total_sold.toLocaleString()}</TableCell>
                  <TableCell>€{report.total_cost_eur.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>€{report.total_proceeds_eur.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className={report.realized_pnl_eur >= 0 ? "text-green-400" : "text-red-400"}>
                    €{report.realized_pnl_eur.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>{report.current_holdings.toLocaleString()}</TableCell>
                  <TableCell>€{report.current_value_eur.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}</TableCell>
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
    dest_wallet_address: ""
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
      
      await api.post("/fiat-transactions", { 
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
      });
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
        dest_wallet_address: ""
      });
      fetchAccounts();
      fetchTransactions(selectedAccount.id);
    } catch (error) {
      toast.error("Erreur lors de la création");
    }
  };

  // Determine if we need source or destination input based on transaction type
  const needsSourceInput = ["deposit", "crypto_sell", "transfer_in"].includes(newTransaction.type);
  const needsDestInput = ["withdrawal", "crypto_buy", "transfer_out"].includes(newTransaction.type);

  return (
    <div className="page-content" data-testid="fiat-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Comptes Fiat</h1>
          <p className="page-subtitle">Gérez vos comptes bancaires</p>
        </div>
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

                            {/* Source - affiché pour dépôts, ventes crypto, virements entrants */}
                            {needsSourceInput && (
                              <div className="p-3 bg-zinc-800/50 rounded-lg space-y-3">
                                <Label className="text-green-400">Origine (Source)</Label>
                                <Select value={newTransaction.source_type} onValueChange={(v) => setNewTransaction({...newTransaction, source_type: v, source_account_id: "", source_wallet_id: "", source_wallet_address: ""})}>
                                  <SelectTrigger><SelectValue placeholder="Type d'origine" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="external">Externe (Autre)</SelectItem>
                                    <SelectItem value="bank">Compte Fiat</SelectItem>
                                    <SelectItem value="wallet">Wallet Crypto</SelectItem>
                                  </SelectContent>
                                </Select>
                                
                                {newTransaction.source_type === "bank" && (
                                  <Select value={newTransaction.source_account_id} onValueChange={(v) => setNewTransaction({...newTransaction, source_account_id: v})}>
                                    <SelectTrigger><SelectValue placeholder="Sélectionner le compte" /></SelectTrigger>
                                    <SelectContent>
                                      {accounts.filter(a => a.id !== selectedAccount.id).map(a => (
                                        <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                                
                                {newTransaction.source_type === "wallet" && (
                                  <>
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
                                    <SelectItem value="wallet">Wallet Crypto</SelectItem>
                                  </SelectContent>
                                </Select>
                                
                                {newTransaction.dest_type === "bank" && (
                                  <Select value={newTransaction.dest_account_id} onValueChange={(v) => setNewTransaction({...newTransaction, dest_account_id: v})}>
                                    <SelectTrigger><SelectValue placeholder="Sélectionner le compte" /></SelectTrigger>
                                    <SelectContent>
                                      {accounts.filter(a => a.id !== selectedAccount.id).map(a => (
                                        <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                                
                                {newTransaction.dest_type === "wallet" && (
                                  <>
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
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  ) : <div className="empty-state-sm"><p>Aucune transaction</p></div>}
                </CardContent>
              </Card>
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
  const [portfolio, setPortfolio] = useState({ assets: [] });
  const [transactions, setTransactions] = useState([]);

  const api = createAuthenticatedApi(accessToken);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [portfolioRes, txRes] = await Promise.all([api.get("/portfolio/summary"), api.get("/transactions", { params: { page_size: 1000 } })]);
        setPortfolio(portfolioRes.data);
        setTransactions(txRes.data.transactions);
      } catch (error) {
        console.error("Error:", error);
      }
    };
    fetchData();
  }, []);

  const totalFees = transactions.reduce((sum, tx) => sum + (tx.fees || 0), 0);
  const totalBuys = transactions.filter(tx => tx.type === "Buy").reduce((sum, tx) => sum + tx.value_eur, 0);
  const totalSells = transactions.filter(tx => tx.type === "Sell").reduce((sum, tx) => sum + tx.value_eur, 0);

  return (
    <div className="page-content" data-testid="reports-page">
      <div className="page-header"><div><h1 className="page-title">Rapports</h1><p className="page-subtitle">Portfolio analysis</p></div></div>
      <div className="reports-grid">
        <Card><CardHeader><CardTitle>Total Fees</CardTitle></CardHeader><CardContent><div className="report-value">{totalFees.toFixed(2)} EUR</div></CardContent></Card>
        <Card><CardHeader><CardTitle>Total Buys</CardTitle></CardHeader><CardContent><div className="report-value text-green-400">{totalBuys.toFixed(2)} EUR</div></CardContent></Card>
        <Card><CardHeader><CardTitle>Total Sells</CardTitle></CardHeader><CardContent><div className="report-value text-red-400">{totalSells.toFixed(2)} EUR</div></CardContent></Card>
        <Card className="col-span-full"><CardHeader><CardTitle>Holdings</CardTitle></CardHeader><CardContent>
          <Table><TableHeader><TableRow><TableHead>Asset</TableHead><TableHead>Amount</TableHead><TableHead>Value EUR</TableHead></TableRow></TableHeader>
            <TableBody>{portfolio.assets.map((a) => (<TableRow key={a.asset}><TableCell>{a.asset}</TableCell><TableCell>{a.amount.toLocaleString()}</TableCell><TableCell>€{a.value_eur.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}</TableCell></TableRow>))}</TableBody></Table>
        </CardContent></Card>
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
