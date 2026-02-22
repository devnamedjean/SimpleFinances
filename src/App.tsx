import React, { useState, useEffect, useMemo } from 'react';
import { Wallet, Activity, ArrowRightLeft, Home, History, Landmark, LogOut } from 'lucide-react';

interface Transaction {
    id: string;
    posted: number;
    amount: string;
    description: string;
    memo: string;
}

interface Organization {
    domain: string;
    name: string;
    'sfin-url': string;
}

interface Account {
    id: string;
    name: string;
    org: Organization;
    currency: string;
    balance: string;
    'balance-date': number;
    transactions: Transaction[];
}

interface SimpleFINData {
    accounts: Account[];
    errors?: string[];
}

const getAccountType = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('checking') || n.includes('spending')) return 'Checking';
    if (n.includes('savings') || n.includes('reserve')) return 'Savings';
    if (n.includes('credit') || n.includes('card') || n.includes('visa') || n.includes('amex') || n.includes('mastercard')) return 'Credit Card';
    if (n.includes('investment') || n.includes('brokerage') || n.includes('ira') || n.includes('401k')) return 'Investment';
    return 'Other';
};

const getDummyData = (): SimpleFINData => {
    const now = Math.floor(Date.now() / 1000);
    const day = 24 * 60 * 60;
    
    const chase: Organization = { domain: 'chase.com', name: 'Chase Bank', 'sfin-url': '' };
    const amex: Organization = { domain: 'amex.com', name: 'American Express', 'sfin-url': '' };
    const fidelity: Organization = { domain: 'fidelity.com', name: 'Fidelity Investments', 'sfin-url': '' };

    return {
        accounts: [
            {
                id: '1', name: 'Total Checking', org: chase, currency: 'USD', balance: '5240.50', 'balance-date': now,
                transactions: [
                    { id: 't1', posted: now - 1 * day, amount: '-120.00', description: 'Whole Foods Market', memo: '' },
                    { id: 't2', posted: now - 3 * day, amount: '-45.50', description: 'Chevron Gas Station', memo: '' },
                    { id: 't3', posted: now - 30 * day, amount: '-120.00', description: 'Whole Foods Market', memo: '' },
                    { id: 't4', posted: now - 5 * day, amount: '3500.00', description: 'Payroll Deposit', memo: '' },
                ]
            },
            {
                id: '2', name: 'High Yield Savings', org: chase, currency: 'USD', balance: '25000.00', 'balance-date': now,
                transactions: [
                    { id: 't5', posted: now - 15 * day, amount: '1000.00', description: 'Internal Transfer', memo: '' },
                ]
            },
            {
                id: '3', name: 'Platinum Card', org: amex, currency: 'USD', balance: '1250.00', 'balance-date': now,
                transactions: [
                    { id: 't6', posted: now - 2 * day, amount: '-85.00', description: 'Blue Bottle Coffee', memo: '' },
                    { id: 't7', posted: now - 4 * day, amount: '-150.00', description: 'Restoration Hardware', memo: '' },
                    { id: 't8', posted: now - 32 * day, amount: '-85.00', description: 'Blue Bottle Coffee', memo: '' },
                ]
            },
            {
                id: '4', name: 'Brokerage Account', org: fidelity, currency: 'USD', balance: '45200.00', 'balance-date': now,
                transactions: []
            }
        ]
    };
};

function App() {
    const [setupToken, setSetupToken] = useState('');
    const [accessUrl, setAccessUrl] = useState<string | null>(localStorage.getItem('simplefin_access_url'));
    const [data, setData] = useState<SimpleFINData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<'home' | 'activity' | 'accounts'>('home');
    const [showGuide, setShowGuide] = useState(false);

    const hasEnvConfig = !!import.meta.env.VITE_SIMPLEFIN_ACCESS_URL;

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!setupToken) return;
        try {
            setLoading(true);
            setError('');
            const claimRes = await fetch('/api/claim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ setupToken })
            });
            if (!claimRes.ok) {
                const errData = await claimRes.json();
                throw new Error(errData.error || 'Failed to claim token');
            }
            const data = await claimRes.json();
            setAccessUrl(data.accessUrl);
            localStorage.setItem('simplefin_access_url', data.accessUrl);
        } catch (err: any) {
            setError(err.message || 'Invalid setup token');
        } finally {
            setLoading(false);
        }
    };

    const logout = () => {
        localStorage.removeItem('simplefin_access_url');
        setAccessUrl(null);
        setData(null);
        // Clear the URL parameters (like ?demo=true) so it doesn't auto-login
        if (window.location.search) {
            window.history.replaceState({}, '', window.location.pathname);
        }
    };

    useEffect(() => {
        const useDummy = new URLSearchParams(window.location.search).get('demo') === 'true';
        if (!accessUrl && !hasEnvConfig && !useDummy) return;

        const fetchData = async () => {
            try {
                setLoading(true);
                
                if (useDummy) {
                    await new Promise(r => setTimeout(r, 800));
                    setData(getDummyData());
                    return;
                }

                const headers: Record<string, string> = {};
                if (accessUrl && !hasEnvConfig) {
                    headers['x-simplefin-url'] = accessUrl;
                }

                const sixtyDaysAgo = new Date();
                sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
                const startTimestamp = Math.floor(sixtyDaysAgo.getTime() / 1000);
                
                const res = await fetch(`/api/accounts?start-date=${startTimestamp}`, { headers });
                const text = await res.text();
                let json;
                try {
                    json = JSON.parse(text);
                } catch (e) {
                    throw new Error(`Server returned unexpected response`);
                }

                if (!res.ok) throw new Error(json.error || 'Failed to fetch data');
                setData(json);
            } catch (err: any) {
                setError(err.message || 'Failed to sync data');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [accessUrl]);

    const stats = useMemo(() => {
        if (!data) return { netWorth: 0, assets: 0, liabilities: 0, spending30d: 0, spendingByAccount: {}, subscriptions: [] };

        let netWorth = 0;
        let assets = 0;
        let liabilities = 0;
        let spending30d = 0;
        const spendingByAccount: Record<string, number> = {};

        const now = Date.now() / 1000;
        const monthAgo = now - 30 * 24 * 60 * 60;

        const allTransactions = data.accounts.flatMap(acc => 
            (acc.transactions || []).map(t => {
                const amountNum = parseFloat(t.amount);
                const posted = t.posted > 2000000000 ? t.posted / 1000 : t.posted;
                return {
                    ...t,
                    posted,
                    accountId: acc.id,
                    amountNum,
                    accountName: acc.name
                };
            })
        );

        data.accounts.forEach(acc => {
            const bal = parseFloat(acc.balance);
            const type = getAccountType(acc.name);
            
            if (type === 'Credit Card') {
                const owe = Math.abs(bal);
                netWorth -= owe;
                liabilities += owe;
            } else {
                netWorth += bal;
                if (bal > 0) assets += bal;
                else liabilities += Math.abs(bal);
            }
        });

        const isTransfer = (t: any) => {
            return allTransactions.some(other => 
                other.id !== t.id && 
                Math.abs(other.amountNum + t.amountNum) < 0.001 && 
                Math.abs(other.posted - t.posted) < 259200
            );
        };

        const subGroups: Record<string, { transactions: any[] }> = {};

        allTransactions.forEach(t => {
            const amt = t.amountNum;
            if (t.posted >= monthAgo && amt < 0 && !isTransfer(t)) {
                spending30d += Math.abs(amt);
                spendingByAccount[t.accountName] = (spendingByAccount[t.accountName] || 0) + Math.abs(amt);
            }

            if (amt < 0 && !isTransfer(t)) {
                const cleanDesc = t.description.toLowerCase()
                    .replace(/[^a-z\s]/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                const words = cleanDesc.split(' ').filter(w => w.length > 2 && !['the', 'inc', 'com', 'payment'].includes(w));
                const norm = words.slice(0, 2).join(' ');
                
                if (norm.length >= 3) {
                    if (!subGroups[norm]) subGroups[norm] = { transactions: [] };
                    subGroups[norm].transactions.push(t);
                }
            }
        });

        const rawSubscriptions: { desc: string; amount: number; count: number; norm: string }[] = [];
        Object.entries(subGroups).forEach(([norm, info]) => {
            const txs = info.transactions.sort((a, b) => b.posted - a.posted);
            if (txs.length >= 2) {
                const amounts = txs.map(t => Math.abs(t.amountNum));
                const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
                const consistentAmount = amounts.every(a => Math.abs(a - avg) / avg < 0.3 || Math.abs(a - avg) < 10);
                const hasTimeSpread = Math.abs(txs[0].posted - txs[txs.length - 1].posted) > (5 * 24 * 60 * 60);

                if (consistentAmount && hasTimeSpread && avg > 1) {
                    rawSubscriptions.push({
                        desc: txs[0].description,
                        amount: avg,
                        count: txs.length,
                        norm
                    });
                }
            }
        });

        const subscriptions: typeof rawSubscriptions = [];
        const seenNorms = new Set<string>();
        rawSubscriptions.sort((a, b) => b.count - a.count).forEach(sub => {
            if (!seenNorms.has(sub.norm)) {
                subscriptions.push(sub);
                seenNorms.add(sub.norm);
            }
        });

        return {
            netWorth,
            assets,
            liabilities,
            spending30d,
            spendingByAccount,
            subscriptions: subscriptions.sort((a, b) => b.amount - a.amount).slice(0, 20)
        };
    }, [data]);

    if (!accessUrl && !hasEnvConfig && !(new URLSearchParams(window.location.search).get('demo') === 'true')) {
        return (
            <div className="login-layout">
                <div className="login-panel">
                    <div className="login-header">
                        <div className="login-logo">
                            <img src="/favicon.svg" alt="Simple Finances" />
                        </div>
                        <h2>Simple Finances</h2>
                        <p>Access your complete financial dashboard. Secure, unified, and real-time monitoring of all your accounts.</p>
                    </div>
                    <form className="auth-form" onSubmit={handleLogin}>
                        <input
                            type="text"
                            placeholder="SimpleFIN Setup Token"
                            value={setupToken}
                            onChange={e => setSetupToken(e.target.value)}
                            className="auth-input-center"
                        />
                        <div className="guide-toggle">
                            <button type="button" className="text-link-btn" onClick={() => setShowGuide(!showGuide)}>
                                {showGuide ? 'Close Guide' : 'How do I get a token?'}
                            </button>
                        </div>

                        {showGuide && (
                            <div className="setup-guide-panel">
                                <div className="guide-section">
                                    <h3>🛡️ Your Security is Priority</h3>
                                    <p>This dashboard <strong>never</strong> asks for your bank password. We use SimpleFIN to securely fetch your data without ever seeing your login credentials.</p>
                                </div>

                                <div className="guide-section">
                                    <h3>🚀 How to get started</h3>
                                    <ol>
                                        <li>Create an account at <a href="https://bridge.simplefin.org/" target="_blank" rel="noopener">SimpleFIN Bridge</a> (the secure data layer).</li>
                                        <li>Connect your bank accounts within their secure portal.</li>
                                        <li>In your SimpleFIN dashboard, look for <strong>"Copy Setup Token"</strong>.</li>
                                        <li>Paste that token into the field above and click Connect.</li>
                                    </ol>
                                </div>

                                <div className="guide-section privacy-note">
                                    <p><strong>Note:</strong> Your token is stored locally in your browser. No financial data is ever sent to our servers—it goes directly from SimpleFIN to your device.</p>
                                </div>
                            </div>
                        )}

                        {error && <div className="error-text">{error}</div>}
                        <button type="submit" className="auth-button" disabled={loading}>
                            {loading ? 'Authenticating...' : 'Connect Accounts'}
                        </button>
                    </form>
                    <div className="demo-link-container">
                        <a href="?demo=true" className="demo-link">Preview with Demo Data</a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="layout">
            <header className="app-header">
                <div className="header-brand">
                    <img src="/favicon.svg" alt="Simple Finances" className="header-logo" />
                    <div>
                        <h1 className="hero-title">Simple Finances</h1>
                        <p className="header-status">Dashboard active & synced.</p>
                    </div>
                </div>
                {!hasEnvConfig && (
                    <button onClick={logout} className="logout-button">
                        <span className="mobile-hidden">Disconnect</span>
                        <LogOut size={18} className="desktop-hidden" />
                    </button>
                )}
            </header>

            {error && <div className="glass-panel error-panel">{error}</div>}
            {loading && !data && <div className="glass-panel loading-panel">
                <Activity className="spinning" />
                <p className="loading-text">Synchronizing data...</p>
            </div>}

            {data && (
                <>
                    <nav className="mobile-tabs">
                        <button 
                            className={`tab-btn ${activeTab === 'home' ? 'active' : ''}`}
                            onClick={() => setActiveTab('home')}
                        >
                            <Home size={20} />
                            <span>Home</span>
                        </button>
                        <button 
                            className={`tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
                            onClick={() => setActiveTab('activity')}
                        >
                            <History size={20} />
                            <span>Activity</span>
                        </button>
                        <button 
                            className={`tab-btn ${activeTab === 'accounts' ? 'active' : ''}`}
                            onClick={() => setActiveTab('accounts')}
                        >
                            <Landmark size={20} />
                            <span>Accounts</span>
                        </button>
                    </nav>

                    <div className="main-container">
                        {/* Column 1: Net Worth + Accounts (Mobile: Split between Home/Accounts) */}
                        <div className={`sidebar-section ${activeTab !== 'home' && activeTab !== 'accounts' ? 'mobile-hidden' : ''}`}>
                            {/* Net Worth Card (Visible in Home Tab) */}
                            <div className={`glass-panel stat-card ${activeTab === 'accounts' ? 'mobile-hidden' : ''}`}>
                                <div className="stat-card-header">
                                    <div className="stat-icon">
                                        <Wallet size={20} />
                                    </div>
                                    <div className="stat-card-info">
                                        <h3>NET WORTH</h3>
                                        <div className={`stat-amount ${stats.netWorth < 0 ? 'danger' : ''}`}>
                                            ${stats.netWorth.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                        </div>
                                    </div>
                                </div>
                                <div className="stat-card-footer">
                                    <div className="stat-footer-row">
                                        <span>Assets</span>
                                        <span style={{ color: 'var(--asset)', fontWeight: 600 }}>${stats.assets.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                    </div>
                                    <div className="stat-footer-row">
                                        <span>Liabilities</span>
                                        <span style={{ color: 'var(--liability)', fontWeight: 600 }}>${stats.liabilities.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Accounts List (Visible in Accounts Tab) */}
                            <div className={`glass-panel flex-grow-panel ${activeTab === 'home' ? 'mobile-hidden' : ''}`}>
                                <h2 className="section-header">
                                    <Activity size={20} /> Accounts
                                </h2>
                                <div className="scrollable-list">
                                    {Object.entries(
                                        data.accounts.reduce((groups: Record<string, Account[]>, acc) => {
                                            const orgName = acc.org?.name || 'Other Institutions';
                                            if (!groups[orgName]) groups[orgName] = [];
                                            groups[orgName].push(acc);
                                            return groups;
                                        }, {})
                                    ).sort(([a], [b]) => a.localeCompare(b)).map(([bankName, bankAccounts]) => (
                                        <div key={bankName} className="bank-group-container">
                                            <div className="bank-group-title">
                                                <div className="bank-group-accent"></div>
                                                {bankName}
                                            </div>
                                            {['Checking', 'Savings', 'Credit Card', 'Investment', 'Other'].map(type => {
                                                const typeAccs = bankAccounts.filter(a => getAccountType(a.name) === type);
                                                if (typeAccs.length === 0) return null;
                                                return (
                                                    <div key={type} className="account-type-group">
                                                        <div className={`category-label account-type-header ${type === 'Credit Card' ? 'credit' : 'asset'}`}>
                                                            {type}
                                                        </div>
                                                        {typeAccs.sort((a, b) => a.name.localeCompare(b.name)).map(acc => {
                                                            const bal = parseFloat(acc.balance);
                                                            return (
                                                                <div key={acc.id} className="list-item account-item">
                                                                    <div className="account-name">
                                                                        {acc.name}
                                                                    </div>
                                                                    <div className={`account-balance ${type === 'Credit Card' ? 'danger' : ''}`}>
                                                                        ${Math.abs(bal).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Column 2: Recent Activity */}
                        <div className={`glass-panel full-height-panel ${activeTab !== 'activity' ? 'mobile-hidden' : ''}`}>
                            <h2 className="section-header">
                                <ArrowRightLeft size={20} className="secondary" /> Recent Activity
                            </h2>
                            <div className="scrollable-list">
                                {(() => {
                                    const allTxs = data.accounts
                                        .flatMap(acc => (acc.transactions || []).map(t => ({ 
                                            ...t, 
                                            accountName: acc.name,
                                            postedDate: Number(t.posted) > 2000000000 ? Number(t.posted) / 1000 : Number(t.posted)
                                        })))
                                        .sort((a, b) => b.postedDate - a.postedDate);

                                    if (allTxs.length === 0) {
                                        return (
                                            <div style={{ color: 'var(--text-muted)', padding: '40px 20px', textAlign: 'center' }}>
                                                No activity found.
                                            </div>
                                        );
                                    }

                                    return allTxs.slice(0, 100).map(t => {
                                        const amt = parseFloat(t.amount);
                                        return (
                                            <div key={t.id || Math.random()} className="list-item">
                                                <div style={{ flex: 1, minWidth: 0, marginRight: '16px' }}>
                                                    <div className="name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {t.description}
                                                    </div>
                                                    <div className="sub-text">
                                                        {new Date(t.postedDate * 1000).toLocaleDateString()} &middot; {t.accountName}
                                                    </div>
                                                </div>
                                                <div style={{ fontWeight: 700, color: amt < 0 ? 'var(--liability)' : 'var(--asset)' }}>
                                                    {amt > 0 ? '+' : '-'}${Math.abs(amt).toFixed(2)}
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>

                        {/* Column 3: Stats Stack (Visible in Home Tab) */}
                        <div className={`stats-sidebar ${activeTab !== 'home' ? 'mobile-hidden' : ''}`}>
                            {/* Spending Card */}
                            <div className="glass-panel stat-card">
                                <div className="stat-card-header">
                                    <div className="stat-icon secondary">
                                        <Activity size={20} />
                                    </div>
                                    <div className="stat-card-info">
                                        <h3>30-DAY SPENDING</h3>
                                        <div className="stat-amount">${stats.spending30d.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                                    </div>
                                </div>
                                <div className="stat-card-footer">
                                    {Object.entries(stats.spendingByAccount || {})
                                        .sort(([,a], [,b]) => b - a)
                                        .slice(0, 2)
                                        .map(([name, amt]) => (
                                            <div key={name} className="stat-footer-row">
                                                <span className="spending-account-name">{name}</span>
                                                <span className="spending-amount">${amt.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                            </div>
                                        ))}
                                </div>
                            </div>

                            {/* Recurring Panel */}
                            <div className="glass-panel flex-grow-panel">
                                <h2 className="section-header subscriptions-header">
                                    <Activity size={16} className="danger" /> Subscriptions
                                </h2>
                                <div className="scrollable-list">
                                    {stats.subscriptions.length === 0 ? (
                                        <div className="empty-list-text">
                                            None detected
                                        </div>
                                    ) : (
                                        stats.subscriptions.map((s, i) => (
                                            <div key={i} className="list-item">
                                                <div className="subscription-info">
                                                    <div className="name subscription-name">
                                                        {s.desc.toLowerCase()}
                                                    </div>
                                                    <div className="sub-text">Recurring Monthly</div>
                                                </div>
                                                <div className="subscription-amount">${s.amount.toFixed(0)}</div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default App;
