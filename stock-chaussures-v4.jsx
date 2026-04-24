import React, { useState, useEffect } from 'react';
import { Package, TrendingUp, DollarSign, ShoppingBag, Plus, Edit2, Trash2, LogOut, User, Clock, X, Camera, Check, Minus, ChevronDown, ChevronUp, ArrowRightLeft, Home, Users, AlertCircle } from 'lucide-react';

const LIEUX = ['Mehdi', 'Imran'];
const STORAGE_KEY = 'stock_v4';
const HISTORY_KEY = 'history_v4';

export default function StockChaussures() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userName, setUserName] = useState('');
  const [stock, setStock] = useState([]);
  const [history, setHistory] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [filterLieu, setFilterLieu] = useState('all');
  const [transferModal, setTransferModal] = useState(null);
  const [lastError, setLastError] = useState(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const stockData = await window.storage.get(STORAGE_KEY, true).catch(() => null);
      const historyData = await window.storage.get(HISTORY_KEY, true).catch(() => null);
      setStock(stockData ? JSON.parse(stockData.value) : []);
      setHistory(historyData ? JSON.parse(historyData.value) : []);
    } catch (e) {
      console.error('Erreur chargement:', e);
      setLastError('Erreur de chargement : ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const saveStock = async (newStock) => {
    try {
      const result = await window.storage.set(STORAGE_KEY, JSON.stringify(newStock), true);
      if (!result) {
        setLastError('La sauvegarde a échoué (pas de résultat)');
        showNotif('Erreur : pas de sauvegarde', 'error');
        return false;
      }
      setStock(newStock);
      setLastError(null);
      return true;
    } catch (e) {
      console.error('Erreur save:', e);
      setLastError('Erreur sauvegarde : ' + e.message);
      showNotif('Erreur de sauvegarde', 'error');
      return false;
    }
  };

  const addHistoryEntry = async (action, details, lieu = null) => {
    const entry = {
      id: Date.now() + Math.random(),
      user: currentUser,
      action,
      details,
      lieu,
      timestamp: new Date().toISOString()
    };
    const newHistory = [entry, ...history].slice(0, 300);
    try {
      await window.storage.set(HISTORY_KEY, JSON.stringify(newHistory), true);
      setHistory(newHistory);
    } catch (e) {
      console.error('Erreur historique:', e);
    }
  };

  const showNotif = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleLogin = () => {
    if (userName.trim()) setCurrentUser(userName.trim());
  };

  const getQteTaille = (taille, lieu) => parseInt(taille.stock?.[lieu] || 0);
  const getTotalTaille = (taille) => LIEUX.reduce((s, l) => s + getQteTaille(taille, l), 0);
  const getTotalModele = (modele, lieu = null) => {
    return (modele.tailles || []).reduce((s, t) => {
      return s + (lieu ? getQteTaille(t, lieu) : getTotalTaille(t));
    }, 0);
  };

  const filteredForStats = filterLieu === 'all' ? null : filterLieu;
  const totalPaires = stock.reduce((s, m) => s + getTotalModele(m, filteredForStats), 0);
  const totalMehdi = stock.reduce((s, m) => s + getTotalModele(m, 'Mehdi'), 0);
  const totalImran = stock.reduce((s, m) => s + getTotalModele(m, 'Imran'), 0);
  const valeurStock = stock.reduce((sum, m) => {
    const prix = parseFloat(m.prixAchat) || 0;
    return sum + getTotalModele(m, filteredForStats) * prix;
  }, 0);
  const valeurVente = stock.reduce((sum, m) => {
    const prix = parseFloat(m.prixVente) || 0;
    return sum + getTotalModele(m, filteredForStats) * prix;
  }, 0);
  const margePotentielle = valeurVente - valeurStock;
  const beneficesRealises = stock.reduce((sum, m) => {
    const marge = (parseFloat(m.prixVente) || 0) - (parseFloat(m.prixAchat) || 0);
    const ventes = (m.historiqueVentes || []).filter(v => !filteredForStats || v.lieu === filteredForStats);
    return sum + ventes.reduce((s, v) => s + (v.quantite || 0), 0) * marge;
  }, 0);
  const ventesMois = stock.reduce((sum, m) => {
    return sum + (m.historiqueVentes || []).filter(v => {
      if (filteredForStats && v.lieu !== filteredForStats) return false;
      const d = new Date(v.date);
      const n = new Date();
      return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
    }).reduce((s, v) => s + (v.quantite || 0), 0);
  }, 0);
  const nbModeles = stock.length;

  const adjustTailleQuantity = async (modeleId, tailleIdx, lieu, delta) => {
    const modele = stock.find(m => m.id === modeleId);
    const taille = modele.tailles[tailleIdx];
    const currentQte = getQteTaille(taille, lieu);
    const newQte = currentQte + delta;
    if (newQte < 0) return;

    const newStock = stock.map(m => {
      if (m.id !== modeleId) return m;
      const newTailles = [...m.tailles];
      const newStockObj = { ...(newTailles[tailleIdx].stock || {}) };
      newStockObj[lieu] = newQte;
      newTailles[tailleIdx] = { ...newTailles[tailleIdx], stock: newStockObj };
      
      const newHistoriqueVentes = delta < 0
        ? [...(m.historiqueVentes || []), { date: new Date().toISOString(), quantite: 1, taille: taille.taille, vendeur: currentUser, lieu }]
        : m.historiqueVentes || [];
      return { ...m, tailles: newTailles, historiqueVentes: newHistoriqueVentes };
    });
    
    const ok = await saveStock(newStock);
    if (ok) {
      if (delta < 0) {
        await addHistoryEntry('VENTE', `${modele.marque} ${modele.modele} T.${taille.taille} · ${parseFloat(modele.prixVente || 0).toFixed(2)}€`, lieu);
      } else {
        await addHistoryEntry('RÉAPPRO', `+1 ${modele.marque} ${modele.modele} T.${taille.taille}`, lieu);
      }
    }
  };

  const transferTaille = async (modeleId, tailleIdx, lieuFrom, lieuTo, qte) => {
    const modele = stock.find(m => m.id === modeleId);
    const taille = modele.tailles[tailleIdx];
    const qteFrom = getQteTaille(taille, lieuFrom);
    if (qte > qteFrom || qte <= 0) return;

    const newStock = stock.map(m => {
      if (m.id !== modeleId) return m;
      const newTailles = [...m.tailles];
      const newStockObj = { ...(newTailles[tailleIdx].stock || {}) };
      newStockObj[lieuFrom] = qteFrom - qte;
      newStockObj[lieuTo] = (parseInt(newStockObj[lieuTo] || 0)) + qte;
      newTailles[tailleIdx] = { ...newTailles[tailleIdx], stock: newStockObj };
      return { ...m, tailles: newTailles };
    });
    const ok = await saveStock(newStock);
    if (ok) {
      await addHistoryEntry('TRANSFERT', `${qte}x ${modele.marque} ${modele.modele} T.${taille.taille} · ${lieuFrom} → ${lieuTo}`);
      showNotif(`Transfert ${lieuFrom} → ${lieuTo} effectué`);
      setTransferModal(null);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl mb-4">
              <ShoppingBag className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-black text-slate-900">STOCK CHAUSSURES</h1>
            <p className="text-slate-500 text-sm mt-2">Qui es-tu ?</p>
          </div>
          <div className="space-y-2 mb-4">
            {LIEUX.map(lieu => (
              <button
                key={lieu}
                onClick={() => setCurrentUser(lieu)}
                className="w-full py-3 px-4 border-2 border-slate-200 rounded-xl font-bold text-slate-900 hover:border-blue-500 hover:bg-blue-50 transition flex items-center justify-center gap-2"
              >
                <User className="w-4 h-4" />{lieu}
              </button>
            ))}
          </div>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
            <div className="relative flex justify-center text-xs"><span className="bg-white px-2 text-slate-400">ou autre nom</span></div>
          </div>
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="Prénom..."
            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none text-slate-900 font-medium"
          />
          <button
            onClick={handleLogin}
            disabled={!userName.trim()}
            className="w-full mt-3 bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50 transition"
          >
            Se connecter
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="text-slate-600">Chargement...</div></div>;
  }

  // IMPORTANT : on affiche TOUS les modèles, pas de filtre qui cache
  const visibleStock = stock;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-white font-medium flex items-center gap-2 ${notification.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          <Check className="w-4 h-4" />{notification.msg}
        </div>
      )}

      {lastError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="text-red-700 flex-1">{lastError}</span>
          <button onClick={() => setLastError(null)} className="text-red-600 font-bold">×</button>
        </div>
      )}

      <header className="bg-slate-900 text-white sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-black text-lg">STOCK</h1>
              <p className="text-xs text-slate-400">{stock.length} modèle{stock.length > 1 ? 's' : ''} enregistré{stock.length > 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowHistoryModal(true)} className="p-2 hover:bg-slate-800 rounded-lg transition">
              <Clock className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 bg-slate-800 px-3 py-2 rounded-lg">
              <User className="w-4 h-4" />
              <span className="text-sm font-medium">{currentUser}</span>
            </div>
            <button onClick={() => setCurrentUser(null)} className="p-2 hover:bg-slate-800 rounded-lg transition">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4">
        <div className="bg-white rounded-2xl p-1.5 mb-4 flex gap-1 shadow-sm border border-slate-100">
          <FilterTab active={filterLieu === 'all'} onClick={() => setFilterLieu('all')} icon={Users} label="Tout" count={totalMehdi + totalImran} />
          <FilterTab active={filterLieu === 'Mehdi'} onClick={() => setFilterLieu('Mehdi')} icon={Home} label="Mehdi" count={totalMehdi} color="blue" />
          <FilterTab active={filterLieu === 'Imran'} onClick={() => setFilterLieu('Imran')} icon={Home} label="Imran" count={totalImran} color="purple" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
          <StatCard icon={Package} label="Paires" value={totalPaires} color="blue" />
          <StatCard icon={ShoppingBag} label="Modèles" value={nbModeles} color="purple" />
          <StatCard icon={DollarSign} label="Valeur stock" value={`${valeurStock.toFixed(0)}€`} color="slate" />
          <StatCard icon={TrendingUp} label="Marge pot." value={`${margePotentielle.toFixed(0)}€`} color="green" />
          <StatCard icon={Check} label="Bénéfices" value={`${beneficesRealises.toFixed(0)}€`} color="emerald" />
          <StatCard icon={ShoppingBag} label="Ventes/mois" value={ventesMois} color="orange" />
        </div>

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-black text-slate-900">
            Inventaire <span className="text-slate-400 font-normal text-sm">({stock.length})</span>
          </h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition shadow-lg text-sm"
          >
            <Plus className="w-4 h-4" />Nouveau modèle
          </button>
        </div>

        {visibleStock.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border-2 border-dashed border-slate-200">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Aucun modèle en stock</p>
            <p className="text-slate-400 text-sm mt-1">Clique sur "Nouveau modèle" pour commencer</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleStock.map((modele) => (
              <ModeleCard
                key={modele.id}
                modele={modele}
                filterLieu={filterLieu}
                expanded={expandedId === modele.id}
                onToggle={() => setExpandedId(expandedId === modele.id ? null : modele.id)}
                onAdjust={adjustTailleQuantity}
                onTransfer={(tailleIdx) => setTransferModal({ modele, tailleIdx })}
                onEdit={() => setEditingItem(modele)}
                onDelete={async () => {
                  if (confirm(`Supprimer ${modele.marque} ${modele.modele} ?`)) {
                    const ok = await saveStock(stock.filter(m => m.id !== modele.id));
                    if (ok) {
                      await addHistoryEntry('SUPPRESSION', `${modele.marque} ${modele.modele}`);
                      showNotif('Modèle supprimé');
                    }
                  }
                }}
                getQteTaille={getQteTaille}
                getTotalTaille={getTotalTaille}
                getTotalModele={getTotalModele}
              />
            ))}
          </div>
        )}
      </main>

      {(showAddModal || editingItem) && (
        <ModeleModal
          modele={editingItem}
          onClose={() => { setShowAddModal(false); setEditingItem(null); }}
          onSave={async (data) => {
            if (editingItem) {
              const newStock = stock.map(m => m.id === editingItem.id ? { ...m, ...data } : m);
              const ok = await saveStock(newStock);
              if (ok) {
                await addHistoryEntry('MODIFICATION', `${data.marque} ${data.modele}`);
                showNotif('Modifications sauvegardées ✓');
                setShowAddModal(false);
                setEditingItem(null);
              }
            } else {
              const newModele = {
                id: Date.now() + Math.random(),
                ...data,
                historiqueVentes: [],
                createdBy: currentUser,
                createdAt: new Date().toISOString()
              };
              const newStock = [...stock, newModele];
              const ok = await saveStock(newStock);
              if (ok) {
                const totalQte = data.tailles.reduce((s, t) => s + LIEUX.reduce((ss, l) => ss + (parseInt(t.stock?.[l]) || 0), 0), 0);
                await addHistoryEntry('AJOUT', `${data.marque} ${data.modele} · ${totalQte} paires (${data.tailles.length} tailles)`);
                showNotif(`✓ ${data.marque} ${data.modele} ajouté`);
                setShowAddModal(false);
                setEditingItem(null);
                // Déplier automatiquement le nouveau modèle
                setExpandedId(newModele.id);
              }
            }
          }}
        />
      )}

      {transferModal && (
        <TransferModal
          modele={transferModal.modele}
          tailleIdx={transferModal.tailleIdx}
          getQteTaille={getQteTaille}
          onClose={() => setTransferModal(null)}
          onTransfer={transferTaille}
        />
      )}

      {showHistoryModal && <HistoryModal history={history} onClose={() => setShowHistoryModal(false)} />}
    </div>
  );
}

function FilterTab({ active, onClick, icon: Icon, label, count, color = 'slate' }) {
  const activeClasses = {
    slate: 'bg-slate-900 text-white',
    blue: 'bg-blue-600 text-white',
    purple: 'bg-purple-600 text-white'
  };
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 px-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition ${active ? activeClasses[color] : 'text-slate-600 hover:bg-slate-50'}`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
      <span className={`text-xs px-1.5 py-0.5 rounded ${active ? 'bg-white/20' : 'bg-slate-100'}`}>{count}</span>
    </button>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const colors = {
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-purple-500 to-purple-600',
    slate: 'from-slate-600 to-slate-700',
    green: 'from-green-500 to-green-600',
    emerald: 'from-emerald-500 to-emerald-600',
    orange: 'from-orange-500 to-orange-600'
  };
  return (
    <div className="bg-white rounded-xl p-2.5 shadow-sm border border-slate-100">
      <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${colors[color]} flex items-center justify-center mb-1.5`}>
        <Icon className="w-3.5 h-3.5 text-white" />
      </div>
      <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-base font-black text-slate-900">{value}</p>
    </div>
  );
}

function ModeleCard({ modele, filterLieu, expanded, onToggle, onAdjust, onTransfer, onEdit, onDelete, getQteTaille, getTotalTaille, getTotalModele }) {
  const totalPaires = getTotalModele(modele);
  const totalMehdi = getTotalModele(modele, 'Mehdi');
  const totalImran = getTotalModele(modele, 'Imran');
  const marge = ((parseFloat(modele.prixVente) || 0) - (parseFloat(modele.prixAchat) || 0));
  const stockLow = totalPaires <= 3;
  const empty = totalPaires === 0;

  return (
    <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${empty ? 'border-orange-200' : 'border-slate-100'}`}>
      <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50 transition" onClick={onToggle}>
        {modele.photo ? (
          <img src={modele.photo} alt={modele.modele} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center flex-shrink-0">
            <Camera className="w-6 h-6 text-slate-300" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">{modele.marque}</p>
          <h3 className="font-black text-slate-900 truncate">{modele.modele}</h3>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{parseFloat(modele.prixVente || 0).toFixed(0)}€</span>
            <span className="text-green-600 font-bold">+{marge.toFixed(0)}€</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">M: {totalMehdi}</span>
            <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">I: {totalImran}</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className={`px-2 py-1 rounded-lg text-xs font-black ${empty ? 'bg-orange-100 text-orange-700' : stockLow ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {totalPaires}
          </div>
          {empty && <p className="text-[9px] text-orange-600 mt-1">À remplir</p>}
        </div>
        <div className="text-slate-400">
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Tailles ({(modele.tailles || []).length})</p>
            <div className="flex gap-1">
              <button onClick={onEdit} className="p-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-100 transition">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={onDelete} className="p-1.5 bg-white border border-slate-200 text-red-600 rounded-lg hover:bg-red-50 transition">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {(!modele.tailles || modele.tailles.length === 0) ? (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
              <p className="text-sm text-orange-700 font-bold">Aucune taille enregistrée</p>
              <p className="text-xs text-orange-600 mt-1">Clique sur l'icône crayon pour en ajouter</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(modele.tailles || []).map((t, idx) => {
                const qMehdi = getQteTaille(t, 'Mehdi');
                const qImran = getQteTaille(t, 'Imran');
                const total = qMehdi + qImran;
                
                return (
                  <div key={idx} className="bg-white rounded-xl p-3 border border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-medium">Taille</span>
                        <span className="font-black text-slate-900 text-lg">{t.taille || '?'}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${total === 0 ? 'bg-slate-100 text-slate-400' : 'bg-slate-100 text-slate-700'}`}>
                          Total: {total}
                        </span>
                      </div>
                      <button
                        onClick={() => onTransfer(idx)}
                        disabled={total === 0}
                        className="p-1.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-blue-50 rounded-lg p-2 border border-blue-100">
                        <p className="text-[10px] font-bold text-blue-700 mb-1">MEHDI</p>
                        <div className="flex items-center justify-between gap-1">
                          <button
                            onClick={() => onAdjust(modele.id, idx, 'Mehdi', -1)}
                            disabled={qMehdi === 0}
                            className="w-7 h-7 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className={`font-black text-lg w-6 text-center ${qMehdi === 0 ? 'text-slate-300' : qMehdi <= 2 ? 'text-orange-600' : 'text-blue-700'}`}>
                            {qMehdi}
                          </span>
                          <button
                            onClick={() => onAdjust(modele.id, idx, 'Mehdi', 1)}
                            className="w-7 h-7 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center justify-center transition"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="bg-purple-50 rounded-lg p-2 border border-purple-100">
                        <p className="text-[10px] font-bold text-purple-700 mb-1">IMRAN</p>
                        <div className="flex items-center justify-between gap-1">
                          <button
                            onClick={() => onAdjust(modele.id, idx, 'Imran', -1)}
                            disabled={qImran === 0}
                            className="w-7 h-7 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className={`font-black text-lg w-6 text-center ${qImran === 0 ? 'text-slate-300' : qImran <= 2 ? 'text-orange-600' : 'text-purple-700'}`}>
                            {qImran}
                          </span>
                          <button
                            onClick={() => onAdjust(modele.id, idx, 'Imran', 1)}
                            className="w-7 h-7 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center justify-center transition"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {(modele.fournisseur || modele.prixAchat) && (
            <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              {modele.fournisseur && <span>📦 {modele.fournisseur}</span>}
              {modele.prixAchat && <span>Achat : {parseFloat(modele.prixAchat).toFixed(2)}€</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TransferModal({ modele, tailleIdx, getQteTaille, onClose, onTransfer }) {
  const taille = modele.tailles[tailleIdx];
  const qMehdi = getQteTaille(taille, 'Mehdi');
  const qImran = getQteTaille(taille, 'Imran');
  const [from, setFrom] = useState(qMehdi > 0 ? 'Mehdi' : 'Imran');
  const [qte, setQte] = useState(1);
  const to = from === 'Mehdi' ? 'Imran' : 'Mehdi';
  const maxQte = from === 'Mehdi' ? qMehdi : qImran;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-black text-lg text-slate-900">Transférer</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 mb-4">
          <p className="font-bold text-slate-900">{modele.marque} {modele.modele}</p>
          <p className="text-sm text-slate-500">Taille {taille.taille}</p>
          <div className="flex gap-2 mt-2">
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold">Mehdi: {qMehdi}</span>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-bold">Imran: {qImran}</span>
          </div>
        </div>

        <label className="block text-sm font-bold text-slate-700 mb-2">Depuis</label>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => setFrom('Mehdi')}
            disabled={qMehdi === 0}
            className={`py-2 rounded-lg font-bold text-sm transition disabled:opacity-30 ${from === 'Mehdi' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700'}`}
          >
            Mehdi ({qMehdi})
          </button>
          <button
            onClick={() => setFrom('Imran')}
            disabled={qImran === 0}
            className={`py-2 rounded-lg font-bold text-sm transition disabled:opacity-30 ${from === 'Imran' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700'}`}
          >
            Imran ({qImran})
          </button>
        </div>

        <div className="flex items-center justify-center gap-3 mb-4 py-2 bg-amber-50 rounded-xl">
          <span className="font-bold text-slate-900">{from}</span>
          <ArrowRightLeft className="w-5 h-5 text-amber-600" />
          <span className="font-bold text-slate-900">{to}</span>
        </div>

        <label className="block text-sm font-bold text-slate-700 mb-2">Quantité (max {maxQte})</label>
        <input
          type="number"
          min="1"
          max={maxQte}
          value={qte}
          onChange={(e) => setQte(parseInt(e.target.value) || 1)}
          className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-amber-500 focus:outline-none text-slate-900 mb-4 font-bold"
        />

        <button
          onClick={() => onTransfer(modele.id, tailleIdx, from, to, qte)}
          disabled={qte < 1 || qte > maxQte}
          className="w-full bg-amber-600 text-white py-3 rounded-xl font-bold hover:bg-amber-700 disabled:opacity-50 transition"
        >
          Transférer {qte} paire{qte > 1 ? 's' : ''}
        </button>
      </div>
    </div>
  );
}

function ModeleModal({ modele, onClose, onSave }) {
  const [formData, setFormData] = useState({
    marque: modele?.marque || '',
    modele: modele?.modele || '',
    couleur: modele?.couleur || '',
    prixAchat: modele?.prixAchat || '',
    prixVente: modele?.prixVente || '',
    fournisseur: modele?.fournisseur || '',
    photo: modele?.photo || '',
    tailles: modele?.tailles || [{ taille: '', stock: { Mehdi: 0, Imran: 0 } }]
  });
  const [saving, setSaving] = useState(false);

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFormData({ ...formData, photo: reader.result });
      reader.readAsDataURL(file);
    }
  };

  const addTaille = () => {
    setFormData({ ...formData, tailles: [...formData.tailles, { taille: '', stock: { Mehdi: 0, Imran: 0 } }] });
  };

  const removeTaille = (idx) => {
    setFormData({ ...formData, tailles: formData.tailles.filter((_, i) => i !== idx) });
  };

  const updateTaille = (idx, field, value, lieu = null) => {
    const newTailles = [...formData.tailles];
    if (lieu) {
      newTailles[idx] = { ...newTailles[idx], stock: { ...(newTailles[idx].stock || {}), [lieu]: parseInt(value) || 0 } };
    } else {
      newTailles[idx] = { ...newTailles[idx], [field]: value };
    }
    setFormData({ ...formData, tailles: newTailles });
  };

  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [plageMin, setPlageMin] = useState(39);
  const [plageMax, setPlageMax] = useState(45);
  const [qteMehdi, setQteMehdi] = useState(1);
  const [qteImran, setQteImran] = useState(0);

  const addPlage = () => {
    const existantes = new Set(formData.tailles.map(t => t.taille));
    const nouvelles = [];
    for (let t = parseInt(plageMin); t <= parseInt(plageMax); t++) {
      if (!existantes.has(String(t))) {
        nouvelles.push({ taille: String(t), stock: { Mehdi: parseInt(qteMehdi) || 0, Imran: parseInt(qteImran) || 0 } });
      }
    }
    setFormData({ ...formData, tailles: [...formData.tailles.filter(t => t.taille), ...nouvelles] });
    setShowQuickAdd(false);
  };

  // Validation : marque + modèle suffisent (on peut ajouter même sans tailles)
  const isValid = formData.marque && formData.modele;

  const handleSaveClick = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    // Nettoyer les tailles vides
    const cleanedData = {
      ...formData,
      tailles: formData.tailles.filter(t => t.taille && t.taille.trim())
    };
    await onSave(cleanedData);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-lg max-h-[95vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between z-10">
          <h2 className="font-black text-lg text-slate-900">{modele ? 'Modifier' : 'Nouveau modèle'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Photo (optionnelle)</label>
            {formData.photo ? (
              <div className="relative aspect-square w-32 rounded-xl overflow-hidden bg-slate-100">
                <img src={formData.photo} alt="" className="w-full h-full object-cover" />
                <button onClick={() => setFormData({ ...formData, photo: '' })} className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-lg">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center aspect-square w-32 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-blue-500 transition">
                <Camera className="w-6 h-6 text-slate-400 mb-1" />
                <span className="text-xs text-slate-500">Photo</span>
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              </label>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Marque *" value={formData.marque} onChange={(v) => setFormData({ ...formData, marque: v })} placeholder="Nike" />
            <Input label="Modèle *" value={formData.modele} onChange={(v) => setFormData({ ...formData, modele: v })} placeholder="Air Max 90" />
            <Input label="Couleur" value={formData.couleur} onChange={(v) => setFormData({ ...formData, couleur: v })} placeholder="Noir/Blanc" />
            <Input label="Fournisseur" value={formData.fournisseur} onChange={(v) => setFormData({ ...formData, fournisseur: v })} placeholder="Nom" />
            <Input label="Prix achat (€)" type="number" value={formData.prixAchat} onChange={(v) => setFormData({ ...formData, prixAchat: v })} placeholder="50" />
            <Input label="Prix vente (€)" type="number" value={formData.prixVente} onChange={(v) => setFormData({ ...formData, prixVente: v })} placeholder="120" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Tailles</label>
              <button onClick={() => setShowQuickAdd(!showQuickAdd)} className="text-xs text-blue-600 font-bold hover:underline">
                + Plage
              </button>
            </div>

            {showQuickAdd && (
              <div className="bg-blue-50 rounded-xl p-3 mb-3 border border-blue-100 space-y-2">
                <p className="text-xs font-bold text-blue-900">Ajout rapide d'une plage de tailles</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-600">Taille min</label>
                    <input type="number" value={plageMin} onChange={(e) => setPlageMin(e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-600">Taille max</label>
                    <input type="number" value={plageMax} onChange={(e) => setPlageMax(e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] text-blue-700 font-bold">Qté Mehdi</label>
                    <input type="number" value={qteMehdi} onChange={(e) => setQteMehdi(e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] text-purple-700 font-bold">Qté Imran</label>
                    <input type="number" value={qteImran} onChange={(e) => setQteImran(e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm" />
                  </div>
                </div>
                <button onClick={addPlage} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-blue-700">
                  Créer les tailles
                </button>
              </div>
            )}

            <div className="space-y-2">
              {formData.tailles.map((t, idx) => (
                <div key={idx} className="bg-slate-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-slate-500 font-medium">Taille</label>
                      <input
                        type="text"
                        value={t.taille}
                        onChange={(e) => updateTaille(idx, 'taille', e.target.value)}
                        placeholder="42"
                        className="w-full px-2 py-1 border border-slate-200 rounded-lg text-sm font-bold"
                      />
                    </div>
                    <button onClick={() => removeTaille(idx)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg mt-3">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-blue-50 rounded-lg p-2 border border-blue-100">
                      <label className="text-[10px] font-bold text-blue-700">MEHDI</label>
                      <input
                        type="number"
                        min="0"
                        value={t.stock?.Mehdi || 0}
                        onChange={(e) => updateTaille(idx, null, e.target.value, 'Mehdi')}
                        className="w-full px-2 py-1 border border-blue-200 rounded text-sm font-bold mt-1"
                      />
                    </div>
                    <div className="bg-purple-50 rounded-lg p-2 border border-purple-100">
                      <label className="text-[10px] font-bold text-purple-700">IMRAN</label>
                      <input
                        type="number"
                        min="0"
                        value={t.stock?.Imran || 0}
                        onChange={(e) => updateTaille(idx, null, e.target.value, 'Imran')}
                        className="w-full px-2 py-1 border border-purple-200 rounded text-sm font-bold mt-1"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={addTaille} className="w-full mt-2 border-2 border-dashed border-slate-300 text-slate-600 py-2 rounded-xl text-sm font-bold hover:border-blue-500 hover:text-blue-600 transition">
              + Ajouter une taille
            </button>
          </div>

          {!isValid && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm text-orange-800">
              <p className="font-bold">Champs obligatoires :</p>
              <ul className="text-xs mt-1 space-y-0.5">
                {!formData.marque && <li>• Marque</li>}
                {!formData.modele && <li>• Modèle</li>}
              </ul>
            </div>
          )}

          <button
            onClick={handleSaveClick}
            disabled={!isValid || saving}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-xl font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {saving ? 'Enregistrement...' : modele ? 'Enregistrer les modifications' : 'Ajouter au stock'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase tracking-wide">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none text-slate-900 text-sm"
      />
    </div>
  );
}

function HistoryModal({ history, onClose }) {
  const [filterLieu, setFilterLieu] = useState('all');
  const formatDate = (iso) => {
    const date = new Date(iso);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const getActionColor = (action) => {
    switch(action) {
      case 'AJOUT': return 'bg-blue-100 text-blue-700';
      case 'VENTE': return 'bg-green-100 text-green-700';
      case 'RÉAPPRO': return 'bg-cyan-100 text-cyan-700';
      case 'TRANSFERT': return 'bg-amber-100 text-amber-700';
      case 'MODIFICATION': return 'bg-orange-100 text-orange-700';
      case 'SUPPRESSION': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const filtered = history.filter(e => filterLieu === 'all' || e.lieu === filterLieu || ['TRANSFERT', 'AJOUT', 'MODIFICATION', 'SUPPRESSION'].includes(e.action));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <h2 className="font-black text-lg text-slate-900">Historique ({history.length})</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-4 pt-3 pb-2 flex gap-2">
          <button onClick={() => setFilterLieu('all')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${filterLieu === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>Tout</button>
          <button onClick={() => setFilterLieu('Mehdi')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${filterLieu === 'Mehdi' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'}`}>Mehdi</button>
          <button onClick={() => setFilterLieu('Imran')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${filterLieu === 'Imran' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-600'}`}>Imran</button>
        </div>
        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {filtered.length === 0 ? (
            <p className="text-center text-slate-400 py-8">Aucune activité</p>
          ) : (
            filtered.map((entry) => (
              <div key={entry.id} className="border border-slate-100 rounded-xl p-3 hover:bg-slate-50">
                <div className="flex items-start justify-between mb-1 gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${getActionColor(entry.action)}`}>{entry.action}</span>
                    {entry.lieu && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${entry.lieu === 'Mehdi' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {entry.lieu}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">{formatDate(entry.timestamp)}</span>
                </div>
                <p className="text-sm text-slate-900 font-medium">{entry.details}</p>
                <p className="text-xs text-slate-500 mt-1">par {entry.user}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
