/* =====================================================================
   Camada de dados
   ---------------------------------------------------------------------
   Hoje os dados ficam no navegador (localStorage). Toda leitura e
   escrita do sistema passa por este arquivo, então para usar um
   servidor no futuro basta trocar o "adapter" (LocalAdapter) por um
   que envie as mudanças para uma API. O resto do sistema não muda.
   ===================================================================== */
(function () {
  const PREFIX = 'gc:';

  /* Adapter atual: navegador. Interface: loadAll(), save(col, rows), saveMeta(meta), clear() */
  const LocalAdapter = {
    loadAll() {
      const out = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX + 'c:')) {
          try { out[k.slice(PREFIX.length + 2)] = JSON.parse(localStorage.getItem(k)) || []; } catch (e) { out[k.slice(PREFIX.length + 2)] = []; }
        }
      }
      let meta = {};
      try { meta = JSON.parse(localStorage.getItem(PREFIX + 'meta')) || {}; } catch (e) {}
      return { cols: out, meta };
    },
    save(col, rows) {
      try { localStorage.setItem(PREFIX + 'c:' + col, JSON.stringify(rows)); }
      catch (e) { console.error(e); window.UI && UI.toast('Espaço do navegador cheio. Faça um backup e limpe arquivos anexados.', 'erro'); }
    },
    saveMeta(meta) { localStorage.setItem(PREFIX + 'meta', JSON.stringify(meta)); },
    clear() {
      Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k));
    }
  };

  /* Coleções que pertencem a uma loja (unidade). As demais são da empresa toda. */
  const UNIT_SCOPED = new Set([
    'produtos', 'movestoque', 'vendas', 'orcamentos', 'trocas', 'deliveries', 'seguros', 'metas',
    'os', 'financeiro', 'fixos', 'caixas', 'ordenscompra', 'inventarios', 'nfe', 'nfeentrada', 'dfe',
    'upgrade_negociacoes', 'etiquetas', 'imeiconsultas', 'conciliacoes', 'maquinas', 'tefpagamentos'
  ]);

  let store = { cols: {}, meta: {} };
  let adapter = LocalAdapter;
  const listeners = [];

  const now = () => new Date().toISOString();

  const DB = {
    UNIT_SCOPED,
    setAdapter(a) { adapter = a; },
    load() { store = adapter.loadAll(); store.meta = store.meta || {}; store.meta.seq = store.meta.seq || {}; },
    isEmpty() { return !store.meta.seeded; },
    markSeeded() { store.meta.seeded = now(); adapter.saveMeta(store.meta); },
    meta() { return store.meta; },
    setMeta(patch) { Object.assign(store.meta, patch); adapter.saveMeta(store.meta); },
    onChange(fn) { listeners.push(fn); },

    raw(col) { return (store.cols[col] = store.cols[col] || []); },
    persist(col) { adapter.save(col, this.raw(col)); listeners.forEach(f => f(col)); },

    nextId(col) {
      store.meta.seq[col] = (store.meta.seq[col] || 0) + 1;
      adapter.saveMeta(store.meta);
      return store.meta.seq[col];
    },

    /* Lista registros. Por padrão: só da loja atual e sem excluídos. */
    list(col, opts = {}) {
      let rows = this.raw(col);
      if (!opts.deleted) rows = rows.filter(r => !r.deleted_at);
      else if (opts.deleted === 'only') rows = rows.filter(r => r.deleted_at);
      if (UNIT_SCOPED.has(col) && !opts.allUnits) {
        const u = this.unitId();
        rows = rows.filter(r => !r.unidade_id || r.unidade_id === u);
      }
      return rows;
    },
    get(col, id) { id = Number(id); return this.raw(col).find(r => r.id === id) || null; },
    find(col, pred, opts) { return this.list(col, opts).find(pred) || null; },

    insert(col, obj, opts = {}) {
      const rec = Object.assign({}, obj);
      rec.id = rec.id || this.nextId(col);
      rec.created_at = rec.created_at || now();
      rec.created_by = rec.created_by || this.userName();
      if (UNIT_SCOPED.has(col) && !rec.unidade_id) rec.unidade_id = this.unitId();
      this.raw(col).push(rec);
      this.persist(col);
      if (!opts.silent) this.audit(col, rec.id, 'Criação', rec);
      return rec;
    },
    update(col, id, patch, opts = {}) {
      const rec = this.get(col, id);
      if (!rec) return null;
      const before = {};
      Object.keys(patch).forEach(k => { before[k] = rec[k]; });
      Object.assign(rec, patch, { updated_at: now(), updated_by: this.userName() });
      this.persist(col);
      if (!opts.silent) this.audit(col, id, 'Alteração', { antes: before, depois: patch });
      return rec;
    },
    /* Exclusão lógica: o registro some das listas mas pode ser restaurado */
    remove(col, id, motivo) {
      const rec = this.get(col, id);
      if (!rec) return;
      rec.deleted_at = now(); rec.deleted_by = this.userName(); if (motivo) rec.delete_reason = motivo;
      this.persist(col);
      this.audit(col, id, 'Exclusão', { motivo: motivo || '' });
    },
    restore(col, id) {
      const rec = this.get(col, id);
      if (!rec) return;
      delete rec.deleted_at; delete rec.deleted_by;
      this.persist(col);
      this.audit(col, id, 'Restauração', {});
    },

    /* Configuração única da empresa */
    cfg() { return this.raw('config')[0] || {}; },
    setCfg(patch) {
      const rows = this.raw('config');
      if (!rows[0]) rows[0] = { id: 1 };
      Object.assign(rows[0], patch);
      this.persist('config');
      this.audit('config', 1, 'Alteração', patch);
    },

    unitId() { return store.meta.unidade_id || 1; },
    setUnit(id) { this.setMeta({ unidade_id: Number(id) }); },
    user() { return store.meta.user_id ? this.get('usuarios', store.meta.user_id) : null; },
    userName() { const u = this.user(); return u ? u.nome : 'sistema'; },

    audit(origem, id, operacao, dados) {
      if (origem === 'auditoria' || origem === 'acessos') return;
      const rows = this.raw('auditoria');
      rows.push({ id: this.nextId('auditoria'), origem, registro: id, operacao, usuario: this.userName(), data: now(), dados: JSON.stringify(dados || {}).slice(0, 2000) });
      if (rows.length > 5000) rows.splice(0, rows.length - 5000);
      adapter.save('auditoria', rows);
    },

    /* Backup completo em JSON */
    exportAll() { return JSON.stringify({ app: 'sistema-loja', versao: 1, gerado_em: now(), meta: store.meta, cols: store.cols }); },
    importAll(json) {
      const data = typeof json === 'string' ? JSON.parse(json) : json;
      if (!data || !data.cols) throw new Error('Arquivo de backup inválido');
      adapter.clear();
      store = { cols: data.cols, meta: data.meta || {} };
      Object.keys(store.cols).forEach(c => adapter.save(c, store.cols[c]));
      adapter.saveMeta(store.meta);
    },
    reset() { adapter.clear(); store = { cols: {}, meta: { seq: {} } }; }
  };

  window.DB = DB;
})();
