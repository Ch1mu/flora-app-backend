require('ts-node/register/transpile-only');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { StockService } = require('../src/stock/stock.service');
const { ReportsService } = require('../src/reports/reports.service');

test('product search transfers only page IDs and rows, preserving totals and parameterized tokens', async () => {
  const queries = [];
  const products = [{ id: 12, name: 'MACETA CLASICA N15', priority: 1 }];
  const prisma = {
    $queryRaw: (sql) => {
      queries.push(sql);
      return Promise.resolve(queries.length === 1 ? [{ id: 12 }] : [{ total: 25n }]);
    },
    $transaction: (operations) => Promise.all(operations),
    stockItem: {
      findMany: async (args) => {
        assert.deepEqual(args.where, { id: { in: [12] } });
        return products;
      },
    },
  };
  const result = await new StockService(prisma).findAll({ search: 'CLÁSICA 15', categoryId: 4, page: 2, limit: 20 });
  assert.deepEqual(result.data, products);
  assert.equal(result.meta.total, 25);
  assert.equal(result.meta.totalPages, 2);
  assert.deepEqual(queries[0].values, [4, 'clasica', '15', 20, 20]);
  assert.match(queries[0].text, /normalize\("name", NFD\)/);
  assert.ok(queries[0].text.includes("U&'[\\0300-\\036f]'"));
});

test('category report combines product aggregates and includes deleted products', async () => {
  const prisma = {
    saleItem: {
      groupBy: async (args) => {
        assert.deepEqual(args.by, ['stockItemId']);
        assert.equal(args.where.sale.branchId, 1);
        assert.ok(args.where.sale.date);
        return [
          { stockItemId: 1, _sum: { subtotal: 100, units: 2 } },
          { stockItemId: 2, _sum: { subtotal: 200, units: 3 } },
          { stockItemId: null, _sum: { subtotal: 100, units: 1 } },
        ];
      },
    },
    stockItem: {
      findMany: async () => [1, 2].map((id) => ({ id, categoryId: 5, category: 'Plantas', categoryRef: { name: 'Plantas' } })),
    },
  };
  const result = await new ReportsService(prisma).salesByCategory({ branchId: 1, from: '2026-10-20', to: '2026-10-20' });
  assert.deepEqual(result, [
    { categoryId: 5, category: 'Plantas', total: 300, units: 5, percentage: 75 },
    { categoryId: null, category: 'Sin categoria', total: 100, units: 1, percentage: 25 },
  ]);
});

test('empty category report returns no rows', async () => {
  const prisma = { saleItem: { groupBy: async () => [] }, stockItem: { findMany: async () => [] } };
  assert.deepEqual(await new ReportsService(prisma).salesByCategory({}), []);
});
