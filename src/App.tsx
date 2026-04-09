import { useState, useEffect, useCallback } from 'react';
import { 
  Shield, 
  Search, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  RefreshCw, 
  ExternalLink, 
  Mail, 
  FileText,
  Activity,
  ChevronRight,
  LayoutDashboard,
  History,
  Settings,
  Bell,
  MoreVertical,
  ArrowUpRight,
  Database,
  Cpu,
  Menu,
  X,
  Filter,
  ArrowRight,
  Moon,
  Sun,
  Sparkles,
  Zap,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LegalUpdate, AgentStats } from './types';
import { AnalysisAgent, ComplianceAgent } from './lib/agents';
import { Button, buttonVariants } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Input } from './components/ui/input';
import { ScrollArea } from './components/ui/scroll-area';
import { Separator } from './components/ui/separator';
import { Sheet, SheetContent, SheetTrigger } from './components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs';
import { Skeleton } from './components/ui/skeleton';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import { cn } from './lib/utils';

export default function App() {
  const [updates, setUpdates] = useState<LegalUpdate[]>([]);
  const [stats, setStats] = useState<AgentStats>({ total: 0, highImpact: 0, pending: 0 });
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [selectedUpdate, setSelectedUpdate] = useState<LegalUpdate | null>(null);
  const [monitorLogs, setMonitorLogs] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'high' | 'pending'>('all');
  const [isConnecting, setIsConnecting] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    toast.info(`Theme switched to ${newTheme === 'dark' ? 'Midnight' : 'Prestige'}`);
  };

  const fetchUpdates = useCallback(async (retries = 3) => {
    try {
      const res = await fetch('/api/updates');
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setUpdates(data);
      
      const statsRes = await fetch('/api/stats');
      if (!statsRes.ok) throw new Error(`HTTP error! status: ${statsRes.status}`);
      const statsData = await statsRes.json();
      setStats(statsData);
      setIsConnecting(false);
    } catch (err) {
      console.error("Failed to fetch updates", err);
      if (retries > 0) {
        setTimeout(() => fetchUpdates(retries - 1), 2000);
      } else {
        setIsConnecting(false);
        toast.error("Connection failed. Retrying...");
      }
    }
  }, []);

  useEffect(() => {
    fetchUpdates();
    const interval = setInterval(fetchUpdates, 30000);
    return () => clearInterval(interval);
  }, [fetchUpdates]);

  const addLog = (msg: string) => {
    setMonitorLogs(prev => [msg, ...prev].slice(0, 12));
  };

  const runMonitoring = async () => {
    if (isMonitoring) return;
    setIsMonitoring(true);
    setMonitorLogs([]);
    addLog("Initializing Monitoring Agent...");
    toast.info("Starting legal monitoring scan...");
    
    const urls = [
      "https://www.dol.gov/newsroom/releases",
      "https://www.sec.gov/news/pressreleases",
      "https://www.ftc.gov/news-events/news/press-releases"
    ];

    try {
      for (const url of urls) {
        if (urls.indexOf(url) > 0) {
          await new Promise(r => setTimeout(r, 1500));
        }
        
        addLog(`Accessing: ${url.split('/')[2]}...`);
        const scrapeRes = await fetch('/api/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        
        if (!scrapeRes.ok) {
          addLog(`Warning: Failed to access ${url}`);
          continue;
        }
        const scrapedData = await scrapeRes.json();
        
        addLog(`AI Analysis: Processing "${scrapedData.title.substring(0, 30)}..."`);
        const analysis = await AnalysisAgent.analyze(scrapedData);
        
        addLog(`Compliance: Mapping actions for ${analysis.topic}...`);
        const compliance = await ComplianceAgent.suggestActions(analysis);
        
        const fullUpdate: LegalUpdate = {
          source_url: url,
          title: scrapedData.title,
          summary: analysis.summary || "",
          topic: analysis.topic || "General",
          impact_level: analysis.impact_level || "Low",
          compliance_actions: compliance.actions,
          departments: compliance.departments,
          status: 'pending'
        };

        addLog(`Audit: Record committed to database.`);
        await fetch('/api/updates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fullUpdate)
        });
      }
      
      addLog("Monitoring cycle successful.");
      toast.success("Monitoring cycle complete. New updates found.");
      fetchUpdates();
    } catch (err) {
      addLog("Critical: Monitoring cycle interrupted.");
      toast.error("Monitoring cycle failed.");
      console.error(err);
    } finally {
      setIsMonitoring(false);
    }
  };

  const updateStatus = async (id: number, status: LegalUpdate['status']) => {
    try {
      await fetch(`/api/updates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      fetchUpdates();
      toast.success(`Update marked as ${status}`);
      if (selectedUpdate?.id === id) {
        setSelectedUpdate(prev => prev ? { ...prev, status } : null);
      }
    } catch (err) {
      console.error("Failed to update status", err);
      toast.error("Failed to update status");
    }
  };

  const filteredUpdates = updates.filter(u => {
    const matchesSearch = u.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         u.topic.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'all' || 
                      (activeTab === 'high' && u.impact_level === 'High') ||
                      (activeTab === 'pending' && u.status === 'pending');
    return matchesSearch && matchesTab;
  });

  const SidebarContent = () => (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Sidebar Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full prestige-grid opacity-[0.03] pointer-events-none" />
      
      <div className="p-8 flex items-center gap-4 relative z-10">
        <motion.div 
          whileHover={{ scale: 1.05, rotate: 5 }}
          className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/20"
        >
          <Shield className="text-primary-foreground w-7 h-7" />
        </motion.div>
        <div>
          <span className="font-serif text-2xl font-semibold tracking-tight block leading-none">LexGuard</span>
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.2em] mt-1 block">Prestige Intelligence</span>
        </div>
      </div>

      <nav className="flex-1 px-6 space-y-2 py-4 relative z-10">
        {[
          { icon: LayoutDashboard, label: 'Dashboard', active: true },
          { icon: History, label: 'Audit Trail' },
          { icon: Bell, label: 'Notifications' },
          { icon: Settings, label: 'Settings' },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Button 
              variant="ghost" 
              className={cn(
                "w-full justify-start gap-4 h-12 transition-all duration-300 group",
                item.active ? "text-primary bg-secondary/80 font-semibold shadow-sm" : "text-muted-foreground hover:text-primary hover:bg-secondary/40"
              )}
            >
              <item.icon className={cn("w-4 h-4 transition-transform group-hover:scale-110", item.active ? "text-primary" : "text-muted-foreground/60")} />
              <span className="text-xs uppercase tracking-widest font-bold">{item.label}</span>
            </Button>
          </motion.div>
        ))}
      </nav>

      <div className="p-6 mt-auto relative z-10">
        <Card className="bg-primary text-primary-foreground border-none shadow-2xl overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <Activity className="w-20 h-20" />
          </div>
          <CardHeader className="p-6 pb-2">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-60">Neural Engine</span>
              <div className={`w-2.5 h-2.5 rounded-full shadow-[0_0_15px_rgba(255,255,255,0.5)] ${isMonitoring ? 'bg-green-400 animate-pulse' : 'bg-white/20'}`} />
            </div>
            <CardTitle className="text-sm font-bold flex items-center gap-3">
              <Cpu className="w-4 h-4 text-primary-foreground/60" /> System Active
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <p className="text-[11px] text-primary-foreground/60 mb-5 font-mono tracking-tighter">
              SCAN_FREQ: 30S // LATENCY: 12MS
            </p>
            <Button 
              onClick={runMonitoring}
              disabled={isMonitoring}
              variant="secondary"
              className="w-full h-11 text-[10px] font-bold uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              {isMonitoring ? (
                <><RefreshCw className="w-3 h-3 animate-spin mr-2" /> Processing...</>
              ) : (
                <><Zap className="w-3 h-3 mr-2 fill-current" /> Initiate Scan</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden relative selection:bg-primary selection:text-primary-foreground">
      {/* Grand Atmospheric Layer */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-primary/5 rounded-full blur-[160px] animate-pulse" />
        <div className="absolute top-[10%] -right-[10%] w-[50%] h-[50%] bg-amber-500/10 rounded-full blur-[140px]" />
        <div className="absolute -bottom-[20%] left-[10%] w-[70%] h-[70%] bg-blue-500/5 rounded-full blur-[180px]" />
        <div className="absolute top-[30%] left-[30%] w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-[140px] animate-pulse" />
        
        {/* Prestige Grid Overlay */}
        <div className="absolute inset-0 prestige-grid opacity-[0.02] dark:opacity-[0.05]" />
        
        {/* Noise Texture */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.04] mix-blend-overlay" />
      </div>

      <Toaster position="top-right" richColors />
      
      <AnimatePresence>
        {isConnecting && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1, filter: 'blur(20px)' }}
            className="fixed inset-0 bg-background z-[100] flex flex-col items-center justify-center gap-8"
          >
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="relative"
            >
              <div className="w-24 h-24 border-[1px] border-primary/10 border-t-primary rounded-full" />
              <Shield className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-primary" />
            </motion.div>
            <div className="text-center space-y-4">
              <motion.h2 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="font-serif text-4xl italic tracking-tighter"
              >
                LexGuard Intelligence
              </motion.h2>
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: 200 }}
                className="h-[1px] bg-primary/20 mx-auto"
              />
              <p className="text-[10px] text-muted-foreground animate-pulse tracking-[0.4em] uppercase font-bold">Establishing Secure Neural Link</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className="hidden lg:flex w-80 border-r border-border bg-card/30 backdrop-blur-3xl flex-col z-20 relative">
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Bar */}
        <header className="h-24 border-b border-border bg-background/40 backdrop-blur-2xl flex items-center justify-between px-6 sm:px-12 sticky top-0 z-30">
          <div className="flex items-center gap-6 flex-1 max-w-2xl">
            <Sheet>
              <SheetTrigger 
                render={<button className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "lg:hidden hover:bg-secondary/50 rounded-xl")} />}
              >
                <Menu className="w-6 h-6" />
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-80 bg-card/95 backdrop-blur-3xl border-r border-white/10">
                <SidebarContent />
              </SheetContent>
            </Sheet>

            <div className="relative w-full group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-all duration-300" />
              <Input 
                type="text" 
                placeholder="Search global intelligence..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 pl-12 pr-6 bg-secondary/30 border-transparent rounded-2xl text-xs sm:text-sm focus-visible:ring-primary/5 focus-visible:border-primary/20 transition-all duration-500 placeholder:text-muted-foreground/50"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-8">
            <motion.button
              whileHover={{ scale: 1.1, rotate: 15 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleTheme}
              className="w-10 h-10 rounded-xl bg-secondary/50 flex items-center justify-center text-primary border border-border/50 hover:bg-secondary transition-colors"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </motion.button>

            <div className="hidden sm:flex items-center gap-4 px-5 py-2.5 bg-secondary/40 rounded-full border border-border/30 backdrop-blur-md">
              <div className="relative">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-green-500 animate-ping opacity-75" />
              </div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">Neural Link Stable</span>
            </div>

            <Separator orientation="vertical" className="h-8 hidden md:block opacity-30" />
            
            <div className="flex items-center gap-4 cursor-pointer group">
              <div className="text-right hidden md:block">
                <p className="text-[11px] font-bold leading-none mb-1.5 group-hover:text-primary transition-colors uppercase tracking-wider">Mani K</p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-[0.2em] font-mono">Chief Legal Officer</p>
              </div>
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-sm font-bold text-primary-foreground shadow-2xl shadow-primary/30"
              >
                MK
              </motion.div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <ScrollArea className="flex-1">
          <div className="p-6 sm:p-10 md:p-16 max-w-7xl mx-auto space-y-12 sm:space-y-20 relative">
            {/* Vertical Rail Text */}
            <div className="absolute left-4 top-40 hidden 2xl:block">
              <span className="writing-mode-vertical-rl rotate-180 text-[9px] font-mono text-muted-foreground/30 uppercase tracking-[1em]">
                LEXGUARD_PRESTIGE_SYSTEM_V4.0
              </span>
            </div>

            {/* Hero Section */}
            <div className="space-y-4 text-center sm:text-left">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 justify-center sm:justify-start"
              >
                <div className="h-[1px] w-12 bg-primary/20" />
                <span className="text-[10px] font-bold uppercase tracking-[0.5em] text-muted-foreground">Strategic Overview</span>
              </motion.div>
              <h1 className="font-serif text-4xl sm:text-6xl md:text-7xl italic tracking-tighter leading-[0.9]">
                Intelligence <br />
                <span className="text-primary/40">Dashboard</span>
              </h1>
              <p className="text-muted-foreground text-lg sm:text-xl font-light max-w-2xl leading-relaxed">
                Autonomous legal monitoring and <span className="text-primary font-medium italic">AI-driven compliance</span> mapping for global enterprises.
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-10">
              {[
                { label: 'Intelligence Scanned', value: stats.total, icon: FileText, color: 'text-primary' },
                { label: 'High Impact Alerts', value: stats.highImpact, icon: AlertTriangle, color: 'text-destructive' },
                { label: 'Pending Review', value: stats.pending, icon: Clock, color: 'text-amber-500' },
              ].map((stat, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Card className="border-none bg-card/40 backdrop-blur-xl shadow-sm hover:shadow-2xl transition-all duration-700 group relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-right from-transparent via-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardContent className="p-8 sm:p-10 flex items-center gap-6 sm:gap-8">
                      <div className={`w-16 h-16 bg-secondary/50 rounded-[2rem] flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-700 shadow-inner`}>
                        <stat.icon className={`w-8 h-8 ${stat.color}`} />
                      </div>
                      <div>
                        <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-[0.3em] mb-2">{stat.label}</p>
                        <p className="text-4xl sm:text-5xl font-serif italic tracking-tighter">{stat.value.toString().padStart(2, '0')}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-12 sm:gap-20">
              <div className="xl:col-span-8 space-y-10 sm:space-y-12">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-border pb-8 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Globe className="w-4 h-4 text-primary/40" />
                      <span className="text-[9px] font-bold uppercase tracking-[0.4em] text-muted-foreground">Live Feed</span>
                    </div>
                    <h2 className="font-serif text-3xl sm:text-4xl italic tracking-tight">Recent Intelligence</h2>
                  </div>
                  <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full sm:w-auto">
                    <TabsList className="bg-secondary/50 p-1.5 h-12 w-full sm:w-auto rounded-2xl border border-border/50">
                      <TabsTrigger value="all" className="flex-1 sm:flex-none text-[10px] uppercase font-bold tracking-[0.2em] px-6 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">All</TabsTrigger>
                      <TabsTrigger value="high" className="flex-1 sm:flex-none text-[10px] uppercase font-bold tracking-[0.2em] px-6 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">High</TabsTrigger>
                      <TabsTrigger value="pending" className="flex-1 sm:flex-none text-[10px] uppercase font-bold tracking-[0.2em] px-6 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">Pending</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <div className="space-y-6">
                  <AnimatePresence mode="popLayout">
                    {filteredUpdates.length === 0 ? (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-card/30 backdrop-blur-xl rounded-[3rem] border border-dashed border-border/50 p-24 text-center"
                      >
                        <div className="w-20 h-20 bg-secondary/50 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
                          <Search className="w-10 h-10 text-muted-foreground/20" />
                        </div>
                        <h3 className="font-serif text-2xl italic mb-3">No Intelligence Found</h3>
                        <p className="text-muted-foreground text-base max-w-xs mx-auto font-light leading-relaxed">Your neural search criteria didn't return any results. Try adjusting filters.</p>
                      </motion.div>
                    ) : (
                      filteredUpdates.map((update, i) => (
                        <motion.div 
                          key={update.id}
                          layout
                          initial={{ opacity: 0, y: 20 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: i * 0.05 }}
                          onClick={() => setSelectedUpdate(update)}
                          className={`group bg-card/40 backdrop-blur-xl p-8 sm:p-10 rounded-[2.5rem] border border-border/40 shadow-sm hover:shadow-2xl hover:border-primary/30 cursor-pointer transition-all duration-700 relative overflow-hidden ${
                            selectedUpdate?.id === update.id ? 'ring-2 ring-primary ring-offset-8 bg-card/60' : ''
                          }`}
                        >
                          <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-4">
                              <Badge className={`rounded-xl px-4 py-1.5 text-[9px] font-bold uppercase tracking-[0.2em] shadow-lg ${
                                update.impact_level === 'High' ? 'bg-destructive text-destructive-foreground' : 
                                update.impact_level === 'Medium' ? 'bg-amber-500 text-white' : 
                                'bg-emerald-600 text-white'
                              }`}>
                                {update.impact_level} Impact
                              </Badge>
                              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.3em] font-bold">{update.topic}</span>
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground/60 tracking-widest">{new Date(update.timestamp!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          </div>
                          
                          <h3 className="font-serif text-2xl sm:text-3xl group-hover:text-primary transition-colors mb-4 leading-tight tracking-tight">{update.title}</h3>
                          <p className="text-sm sm:text-base text-muted-foreground line-clamp-2 leading-relaxed font-light mb-8 italic">{update.summary}</p>
                          
                          <div className="flex items-center justify-between pt-8 border-t border-border/30">
                            <div className="flex items-center gap-4">
                              <div className={`w-3 h-3 rounded-full ${update.status === 'pending' ? 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]'}`} />
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">{update.status}</span>
                            </div>
                            <motion.div 
                              whileHover={{ x: 5 }}
                              className="flex items-center gap-3 text-primary opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Analyze Record</span>
                              <ArrowRight className="w-5 h-5" />
                            </motion.div>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Sidebar Logs */}
              <div className="xl:col-span-4 space-y-12">
                <Card className="border-none shadow-2xl bg-secondary/20 backdrop-blur-xl overflow-hidden rounded-[2.5rem] relative">
                  <div className="absolute top-0 left-0 w-full h-full prestige-grid opacity-[0.02] pointer-events-none" />
                  <CardHeader className="p-10 pb-4 relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Sparkles className="w-4 h-4 text-primary/40" />
                        <CardTitle className="text-[10px] font-bold uppercase tracking-[0.4em] text-muted-foreground">Neural Activity</CardTitle>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${isMonitoring ? 'bg-green-500 animate-pulse' : 'bg-muted'}`} />
                    </div>
                  </CardHeader>
                  <CardContent className="p-10 pt-0 relative z-10">
                    <ScrollArea className="h-[450px] pr-6">
                      <div className="space-y-6">
                        {monitorLogs.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-40 text-center space-y-4">
                            <Database className="w-10 h-10 text-muted-foreground/10" />
                            <p className="text-[11px] text-muted-foreground/40 italic font-serif tracking-widest uppercase">Awaiting neural scan...</p>
                          </div>
                        ) : (
                          monitorLogs.map((log, i) => (
                            <motion.div 
                              key={i}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="flex gap-5 text-[11px] leading-relaxed group/log"
                            >
                              <span className="text-muted-foreground/30 font-mono shrink-0 text-[9px] mt-0.5">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                              <span className={cn(
                                "transition-colors duration-300",
                                i === 0 ? 'text-primary font-bold' : 'text-muted-foreground/80 font-medium group-hover/log:text-primary'
                              )}>{log}</span>
                            </motion.div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card className="bg-primary text-primary-foreground border-none shadow-2xl p-10 rounded-[2.5rem] relative overflow-hidden group">
                  <motion.div 
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 10, repeat: Infinity }}
                    className="absolute -bottom-20 -right-20 w-64 h-64 bg-white/5 rounded-full blur-[80px]" 
                  />
                  <div className="relative z-10">
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-8">
                      <Shield className="w-6 h-6 text-white/80" />
                    </div>
                    <h3 className="font-serif text-3xl italic mb-6 leading-tight">Compliance <br />Strategic Insight</h3>
                    <p className="text-sm text-primary-foreground/70 leading-relaxed font-light mb-10 italic">
                      "High-impact updates often require cross-departmental review within 48 hours to mitigate operational risk."
                    </p>
                    <Button variant="secondary" className="w-full h-14 text-[10px] font-bold uppercase tracking-[0.3em] shadow-2xl hover:scale-[1.02] transition-transform">
                      Strategic Guide <ArrowUpRight className="w-4 h-4 ml-3" />
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Slide-over Detail Panel */}
        <AnimatePresence>
          {selectedUpdate && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedUpdate(null)}
                className="absolute inset-0 bg-background/60 backdrop-blur-xl z-[40]"
              />
              <motion.div 
                initial={{ x: '100%', opacity: 0.5 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0.5 }}
                transition={{ type: 'spring', damping: 35, stiffness: 250 }}
                className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-card shadow-[0_0_150px_rgba(0,0,0,0.2)] z-[50] flex flex-col border-l border-border/50 overflow-hidden"
              >
                {/* Panel Decorative Grid */}
                <div className="absolute inset-0 prestige-grid opacity-[0.03] pointer-events-none" />
                
                <div className="p-8 sm:p-12 border-b border-border/50 flex items-center justify-between bg-background/80 backdrop-blur-2xl sticky top-0 z-10">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Sparkles className="w-4 h-4 text-primary/40" />
                      <span className="text-[9px] font-bold uppercase tracking-[0.5em] text-muted-foreground">Neural Analysis</span>
                    </div>
                    <h3 className="text-3xl sm:text-4xl font-serif italic tracking-tighter leading-none">Intelligence Record</h3>
                    <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.3em] font-bold">ID_REF: {selectedUpdate.id?.toString().padStart(4, '0')}</p>
                  </div>
                  <motion.button 
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setSelectedUpdate(null)}
                    className="w-12 h-12 rounded-2xl bg-secondary/50 flex items-center justify-center hover:bg-secondary transition-colors group"
                  >
                    <X className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                  </motion.button>
                </div>

                <ScrollArea className="flex-1">
                  <div className="p-8 sm:p-12 space-y-12 sm:space-y-16 relative z-10">
                    <section className="space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="h-[1px] w-8 bg-primary/20" />
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.5em] block">Executive Summary</label>
                      </div>
                      <p className="text-xl sm:text-2xl text-primary leading-relaxed font-serif italic tracking-tight">{selectedUpdate.summary}</p>
                    </section>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 sm:gap-16">
                      <section className="space-y-6">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.5em] block">Domain Topic</label>
                        <div className="px-6 py-3 bg-secondary/50 rounded-2xl text-[11px] font-bold text-primary inline-flex items-center gap-3 uppercase tracking-[0.2em] border border-border/30">
                          <Globe className="w-3 h-3" /> {selectedUpdate.topic}
                        </div>
                      </section>
                      <section className="space-y-6">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.5em] block">Impact Severity</label>
                        <Badge className={`px-6 py-3 rounded-2xl text-[11px] font-bold uppercase tracking-[0.2em] shadow-xl ${
                          selectedUpdate.impact_level === 'High' ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'
                        }`}>
                          {selectedUpdate.impact_level} LEVEL
                        </Badge>
                      </section>
                    </div>

                    <section className="space-y-6">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.5em] block">Compliance Directives</label>
                      <div className="bg-secondary/40 border border-border/40 p-8 sm:p-10 rounded-[2.5rem] text-base text-primary leading-relaxed font-light italic shadow-inner relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-[0.03]">
                          <Shield className="w-24 h-24" />
                        </div>
                        {selectedUpdate.compliance_actions}
                      </div>
                    </section>

                    <section className="space-y-6">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.5em] block">Strategic Stakeholders</label>
                      <div className="flex flex-wrap gap-4">
                        {selectedUpdate.departments.split(',').map((dept, i) => (
                          <motion.div
                            key={i}
                            whileHover={{ y: -2 }}
                          >
                            <Badge variant="outline" className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] border-primary/20 bg-primary/5 rounded-xl">
                              {dept.trim()}
                            </Badge>
                          </motion.div>
                        ))}
                      </div>
                    </section>
                  </div>
                </ScrollArea>

                <div className="p-8 sm:p-12 bg-secondary/30 border-t border-border/50 space-y-6 relative z-10 backdrop-blur-2xl">
                  <Button 
                    render={<a href={selectedUpdate.source_url} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "outline" }), "w-full h-16 rounded-[1.5rem] text-[11px] font-bold uppercase tracking-[0.3em] bg-card shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 border-border/50")} />}
                    nativeButton={false}
                  >
                    <ExternalLink className="w-4 h-4 mr-3" /> Verify Original Source
                  </Button>
                  
                  {selectedUpdate.status === 'pending' ? (
                    <Button 
                      onClick={() => updateStatus(selectedUpdate.id!, 'reviewed')}
                      className="w-full h-16 rounded-[1.5rem] text-[11px] font-bold uppercase tracking-[0.3em] shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-500"
                    >
                      <CheckCircle className="w-4 h-4 mr-3" /> Authorize & Review
                    </Button>
                  ) : (
                    <Button disabled className="w-full h-16 rounded-[1.5rem] text-[11px] font-bold uppercase tracking-[0.3em] bg-emerald-600 text-white opacity-100 shadow-xl">
                      <CheckCircle className="w-4 h-4 mr-3" /> Record Reviewed
                    </Button>
                  )}
                  
                  <div className="flex gap-6 pt-4">
                    <Button variant="ghost" className="flex-1 h-12 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-all">
                      <Mail className="w-4 h-4 mr-3" /> Notify Board
                    </Button>
                    <Button variant="ghost" className="flex-1 h-12 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-all">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
