import React, { useState, useEffect, useMemo } from 'react';
import { Wallet, CreditCard, Activity, ArrowRightLeft, LogOut, PieChart, ShieldCheck } from 'lucide-react';

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
            <div className="layout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
                <div className="glass-panel" style={{ width: '100%', maxWidth: '400px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                        <div style={{ marginBottom: '20px' }}>
                                                                                                                                                    <img src="/favicon.svg" alt="Simple Finances" style={{ width: '64px', height: '64px' }} />
                                                                                                                                                </div>
                                                                                                                                                <h2 style={{ fontSize: '1.75rem', marginBottom: '8px' }}>Simple Finances</h2>
                                                                                                                            
                                                                                                                                                                                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Secure, unified financial monitoring.</p>
                    </div>
                    <form className="auth-form" onSubmit={handleLogin}>
                        <input
                            type="text"
                            placeholder="SimpleFIN Setup Token"
                            value={setupToken}
                            onChange={e => setSetupToken(e.target.value)}
                            style={{ textAlign: 'center' }}
                        />
                        {error && <div style={{ color: 'var(--liability)', fontSize: '0.875rem' }}>{error}</div>}
                        <button type="submit" disabled={loading}>
                            {loading ? 'Authenticating...' : 'Connect Accounts'}
                        </button>
                    </form>
                    <div style={{ marginTop: '24px', textAlign: 'center' }}>
                        <a href="?demo=true" style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>Preview with Demo Data</a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="layout">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img src="/favicon.svg" alt="Simple Finances" style={{ width: '32px', height: '32px' }} />
                    <div>
                        <h1 className="hero-title" style={{ fontSize: '1.5rem', marginBottom: 0, fontWeight: 800 }}>Simple Finances</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 500 }}>Dashboard active & synced.</p>
                    </div>
                </div>
                {!hasEnvConfig && (
                    <button onClick={logout} style={{ padding: '8px 16px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '10px', fontWeight: 600 }}>
                        Disconnect
                    </button>
                )}
            </header>

            {error && <div className="glass-panel" style={{ color: 'var(--liability)', marginBottom: '24px', flexShrink: 0 }}>{error}</div>}
            {loading && !data && <div className="glass-panel" style={{ flexShrink: 0, textAlign: 'center', padding: '40px' }}>
                <Activity className="spinning" style={{ margin: '0 auto 16px' }} />
                <p style={{ fontWeight: 600 }}>Synchronizing data...</p>
            </div>}

            {data && (
                <div className="main-container">
                    {/* Column 1: Net Worth + Accounts */}
                    <div className="sidebar-section">
                        {/* Net Worth Card */}
                        <div className="glass-panel stat-card" style={{ padding: '20px', flex: '0 0 auto', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                                <div className="stat-icon">
                                    <Wallet size={20} />
                                </div>
                                <div className="stat-info" style={{ flex: 1 }}>
                                    <h3 style={{ fontSize: '0.7rem', fontWeight: 700 }}>NET WORTH</h3>
                                    <div className="amount" style={{ fontSize: '1.4rem', color: stats.netWorth >= 0 ? 'inherit' : 'var(--liability)' }}>
                                        ${stats.netWorth.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </div>
                                </div>
                            </div>
                            <div style={{ 
                                marginTop: '12px', 
                                paddingTop: '8px', 
                                borderTop: '1px solid rgba(255,255,255,0.05)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px',
                                width: '100%'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Assets</span>
                                    <span style={{ fontWeight: 600, color: 'var(--asset)' }}>${stats.assets.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Liabilities</span>
                                    <span style={{ fontWeight: 600, color: 'var(--liability)' }}>${stats.liabilities.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                </div>
                            </div>
                        </div>

                        <div className="glass-panel" style={{ flex: 1, minHeight: 0 }}>
                            <h2 className="section-header">
                                <Activity size={20} style={{ color: 'var(--primary)' }} /> Accounts
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
                                    <div key={bankName} className="bank-group" style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                                        <div className="bank-name" style={{ 
                                            fontSize: '0.85rem', 
                                            fontWeight: 800, 
                                            color: 'var(--text-main)',
                                            marginBottom: '16px',
                                            borderBottom: '1px solid var(--border-color)',
                                            paddingBottom: '8px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}>
                                            <div style={{ width: '4px', height: '12px', background: 'var(--primary)', borderRadius: '2px' }}></div>
                                            {bankName}
                                        </div>
                                        {['Checking', 'Savings', 'Credit Card', 'Investment', 'Other'].map(type => {
                                            const typeAccs = bankAccounts.filter(a => getAccountType(a.name) === type);
                                            if (typeAccs.length === 0) return null;
                                            return (
                                                <div key={type} style={{ marginBottom: '12px' }}>
                                                    <div className="category-label" style={{ 
                                                        opacity: 0.8,
                                                        color: type === 'Credit Card' ? 'var(--liability)' : 'var(--asset)',
                                                        fontSize: '0.65rem',
                                                        marginBottom: '4px'
                                                    }}>{type}</div>
                                                    {typeAccs.sort((a, b) => a.name.localeCompare(b.name)).map(acc => {
                                                        const bal = parseFloat(acc.balance);
                                                        return (
                                                            <div key={acc.id} className="list-item" style={{ padding: '4px 0', borderBottom: 'none', minHeight: 'auto' }}>
                                                                <div className="name" style={{ 
                                                                    fontSize: '0.85rem', 
                                                                    fontWeight: 500, 
                                                                    color: 'var(--text-muted)',
                                                                    overflow: 'hidden', 
                                                                    textOverflow: 'ellipsis', 
                                                                    whiteSpace: 'nowrap',
                                                                    maxWidth: '140px'
                                                                }}>
                                                                    {acc.name}
                                                                </div>
                                                                <div style={{ 
                                                                    fontWeight: 700, 
                                                                    fontSize: '0.9rem', 
                                                                    color: type === 'Credit Card' ? 'var(--liability)' : 'var(--asset)'
                                                                }}>
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
                    <div className="glass-panel" style={{ height: '100%', flex: 1 }}>
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

                    {/* Column 3: Stats Stack */}
                    <div className="stats-sidebar">
                        {/* Spending Card */}
                        <div className="glass-panel stat-card" style={{ padding: '20px', flex: '0 0 auto', minHeight: 'auto' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                                <div className="stat-icon secondary">
                                    <Activity size={20} />
                                </div>
                                <div className="stat-info" style={{ flex: 1 }}>
                                    <h3 style={{ fontSize: '0.7rem', fontWeight: 700 }}>30-DAY SPENDING</h3>
                                    <div className="amount" style={{ fontSize: '1.4rem' }}>${stats.spending30d.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                                </div>
                            </div>
                            <div style={{ 
                                marginTop: '12px', 
                                paddingTop: '8px', 
                                borderTop: '1px solid rgba(255,255,255,0.05)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px',
                                width: '100%'
                            }}>
                                {Object.entries(stats.spendingByAccount || {})
                                    .sort(([,a], [,b]) => b - a)
                                    .slice(0, 2)
                                    .map(([name, amt]) => (
                                        <div key={name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                                            <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>{name}</span>
                                            <span style={{ fontWeight: 600 }}>${amt.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                        </div>
                                    ))}
                            </div>
                        </div>

                        {/* Recurring Panel */}
                        <div className="glass-panel" style={{ flex: 1, minHeight: 0 }}>
                            <h2 className="section-header" style={{ marginBottom: '12px', fontSize: '0.9rem' }}>
                                <Activity size={16} className="danger" /> Subscriptions
                            </h2>
                            <div className="scrollable-list">
                                {stats.subscriptions.length === 0 ? (
                                    <div style={{ color: 'var(--text-muted)', padding: '10px', textAlign: 'center', fontSize: '0.8rem' }}>
                                        None detected
                                    </div>
                                ) : (
                                    stats.subscriptions.map((s, i) => (
                                        <div key={i} className="list-item" style={{ padding: '8px 0' }}>
                                            <div style={{ flex: 1, minWidth: 0, marginRight: '8px' }}>
                                                <div className="name" style={{ textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                                                    {s.desc.toLowerCase()}
                                                </div>
                                                <div className="sub-text" style={{ fontSize: '0.65rem' }}>Recurring Monthly</div>
                                            </div>
                                            <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>${s.amount.toFixed(0)}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
