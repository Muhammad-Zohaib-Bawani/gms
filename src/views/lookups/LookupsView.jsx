import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Icon } from '../../components/Icons';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import toast from '../../lib/toast';
import { getLookupItems, deleteLookupItem } from '../../api/services/lookupService';
import { getLookupConfig, LOOKUP_CATEGORIES } from './lookupConfig';
import LookupItemModal from './LookupItemModal';

export default function LookupsView({ categoryCode, lang }) {
  const isAr   = lang === 'ar';
  const config = getLookupConfig(categoryCode);

  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [query,      setQuery]      = useState('');
  const [editItem,   setEditItem]   = useState(null);   // item object when editing
  const [showAdd,    setShowAdd]    = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleting,   setDeleting]   = useState(false);

  const catLabel = useMemo(() => {
    const c = LOOKUP_CATEGORIES.find(c => c.code === categoryCode);
    return c ? (isAr ? c.label.ar : c.label.en) : categoryCode;
  }, [categoryCode, isAr]);

  const load = useCallback(async () => {
    if (!categoryCode) return;
    setLoading(true);
    try {
      const r = await getLookupItems(categoryCode, { includeInactive: true });
      setItems(r || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [categoryCode]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i =>
      (i.name || '').toLowerCase().includes(q) ||
      (i.nameAr || '').toLowerCase().includes(q) ||
      (i.code || '').toLowerCase().includes(q));
  }, [items, query]);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteLookupItem(deleteItem.id);
      setDeleteItem(null);
      load();
      toast.success(isAr ? 'تم حذف العنصر' : 'Item deleted');
    } catch {
      toast.error(isAr ? 'تعذّر حذف العنصر' : 'Could not delete item');
    } finally {
      setDeleting(false);
    }
  }

  const columns = useMemo(() => {
    const cols = [];

    if (config.code.show) {
      cols.push({
        id: 'code',
        header: isAr ? config.code.labelAr : config.code.label,
        accessorKey: 'code',
        size: 110,
        cell: ({ getValue }) => (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600 }}>{getValue() || '—'}</span>
        ),
      });
    }

    cols.push({
      id: 'name',
      header: isAr ? 'الاسم' : 'Name',
      accessorKey: 'name',
      cell: ({ row: { original: i } }) => (
        <div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{isAr ? (i.nameAr || i.name) : i.name}</div>
          {isAr ? (i.name && <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{i.name}</div>)
                : (i.nameAr && <div style={{ fontSize: 11, color: 'var(--ink-mute)' }} dir="rtl">{i.nameAr}</div>)}
        </div>
      ),
    });

    config.metaFields.forEach(f => {
      cols.push({
        id: `meta_${f.key}`,
        header: isAr ? f.labelAr : f.label,
        enableSorting: false,
        cell: ({ row: { original: i } }) => (
          <span style={{ fontSize: 12 }}>{i.metadata?.[f.key] || '—'}</span>
        ),
      });
    });

    cols.push({
      id: 'status',
      header: isAr ? 'الحالة' : 'Status',
      accessorKey: 'isActive',
      size: 90,
      cell: ({ getValue }) => {
        const active = getValue();
        return (
          <span className={`chip ${active ? 'confirmed' : 'pending'}`}>
            <span className="dot"/>
            {active ? (isAr ? 'نشط' : 'Active') : (isAr ? 'غير نشط' : 'Inactive')}
          </span>
        );
      },
    });

    cols.push({
      id: 'edit',
      size: 40,
      enableSorting: false,
      cell: ({ row: { original: i } }) => (
        <button className="btn" onClick={e => { e.stopPropagation(); setEditItem(i); }}>
          <Icon name="edit" size={14}/>
        </button>
      ),
    });

    cols.push({
      id: 'delete',
      size: 40,
      enableSorting: false,
      cell: ({ row: { original: i } }) => (
        <button className="btn" style={{ color: '#e05050', borderColor: 'rgba(224,80,80,0.4)' }}
          onClick={e => { e.stopPropagation(); setDeleteItem(i); }}>
          <Icon name="trash" size={14}/>
        </button>
      ),
    });

    return cols;
  }, [config, isAr]);

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{catLabel}</h1>
          <div className="page-sub">
            {filtered.length} {isAr ? 'عنصر' : `item${filtered.length !== 1 ? 's' : ''}`}
          </div>
        </div>
        <div className="page-actions">
          <button className="btn primary" onClick={() => setShowAdd(true)}>
            <Icon name="plus" size={14}/> {isAr ? 'إضافة عنصر' : 'Add Item'}
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <div className="search" style={{ flex: 1, maxWidth: 320 }}>
          <Icon name="search" size={14}/>
          <input
            placeholder={isAr ? 'بحث…' : 'Search…'}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        <DataTable
          columns={columns}
          data={filtered}
          loading={loading}
          emptyText={isAr ? 'لا توجد عناصر بعد' : 'No items yet'}
          showSearch={false}
          pageSize={20}
        />
      </div>

      {/* Add / Edit modals */}
      <LookupItemModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        categoryCode={categoryCode}
        config={config}
        item={null}
        lang={lang}
        onSaved={load}
      />
      <LookupItemModal
        open={!!editItem}
        onClose={() => setEditItem(null)}
        categoryCode={categoryCode}
        config={config}
        item={editItem}
        lang={lang}
        onSaved={load}
      />

      {/* Delete confirm */}
      <Modal
        open={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        title={isAr ? 'حذف العنصر' : 'Delete Item'}
        width={400}
        footer={
          <>
            <button className="btn" onClick={() => setDeleteItem(null)}>{isAr ? 'إلغاء' : 'Cancel'}</button>
            <button className="btn" style={{ color: '#e05050', borderColor: 'rgba(224,80,80,0.4)' }}
              onClick={handleDelete} disabled={deleting}>
              <Icon name="trash" size={13}/> {deleting ? (isAr ? 'جارٍ الحذف…' : 'Deleting…') : (isAr ? 'حذف' : 'Delete')}
            </button>
          </>
        }
      >
        <div style={{ fontSize: 13, color: 'var(--ink-dim)' }}>
          {isAr
            ? `هل تريد حذف "${deleteItem?.nameAr || deleteItem?.name}"؟`
            : `Delete "${deleteItem?.name}"? This can't be undone.`}
        </div>
      </Modal>
    </div>
  );
}
