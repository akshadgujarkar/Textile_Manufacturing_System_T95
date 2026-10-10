import React, { useState } from 'react';
import { Search, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';

export interface Column<T> {
  header: string;
  accessor?: keyof T | ((row: T) => React.ReactNode) | string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  isLoading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchFilter?: (item: T, query: string) => boolean;
  searchFields?: (keyof T | string)[];
  itemsPerPage?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  actionButton?: React.ReactNode;
  keyExtractor?: (item: T) => string | number;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading,
  isLoading = false,
  searchable = true,
  searchPlaceholder = 'Search records...',
  searchFilter,
  searchFields,
  itemsPerPage = 10,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no items matching your criteria.',
  actionButton,
  keyExtractor,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const effectiveLoading = loading !== undefined ? loading : isLoading;

  // Filter records based on search term
  const filteredData = data.filter((item) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();

    if (searchFilter) {
      return searchFilter(item, searchTerm);
    }

    if (searchFields && searchFields.length > 0) {
      return searchFields.some((field) => {
        const val = item[field as keyof T];
        return val !== undefined && val !== null && String(val).toLowerCase().includes(term);
      });
    }

    return Object.values(item).some(
      (val) => val !== undefined && val !== null && String(val).toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Header controls: Search & Action Button */}
      {(searchable || actionButton) && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          {searchable ? (
            <div className="relative min-w-[260px] flex-1 max-w-[400px]">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-on-surface-variant)]"
              />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="m3-input pl-10 h-10 rounded-full"
              />
            </div>
          ) : <div />}
          {actionButton && <div>{actionButton}</div>}
        </div>
      )}

      {/* Table Container */}
      <div className="m3-table-container">
        <table className="m3-table">
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} style={{ width: col.width }}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {effectiveLoading ? (
              Array.from({ length: 5 }).map((_, rIdx) => (
                <tr key={rIdx}>
                  {columns.map((_, cIdx) => (
                    <td key={cIdx}>
                      <div className="h-4 bg-[var(--color-surface-container)] rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-12 px-6">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-14 h-14 rounded-full bg-[var(--color-surface-container)] flex items-center justify-center text-[var(--color-on-surface-variant)]">
                      <Inbox size={28} />
                    </div>
                    <div className="font-bold text-base text-[var(--color-on-surface)] mt-2">
                      {emptyTitle}
                    </div>
                    <div className="text-sm text-[var(--color-on-surface-variant)] max-w-sm">
                      {emptyDescription}
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rIdx) => {
                const rowKey = keyExtractor ? keyExtractor(row) : (row as any).id || (row as any)._id || rIdx;
                return (
                  <tr key={rowKey}>
                    {columns.map((col, cIdx) => {
                      let cellContent: React.ReactNode = '-';
                      if (col.render) {
                        cellContent = col.render(row);
                      } else if (typeof col.accessor === 'function') {
                        cellContent = col.accessor(row);
                      } else if (typeof col.accessor === 'string' || typeof col.accessor === 'number') {
                        cellContent = String(row[col.accessor as keyof T] ?? '-');
                      }
                      return <td key={cIdx}>{cellContent}</td>;
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {!effectiveLoading && filteredData.length > itemsPerPage && (
        <div className="flex items-center justify-between p-2 text-sm text-[var(--color-on-surface-variant)]">
          <div>
            Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredData.length)} of {filteredData.length} records
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="m3-btn m3-btn-outlined text-xs py-1 px-3 flex items-center gap-1"
            >
              <ChevronLeft size={16} /> Prev
            </button>
            <span className="font-bold px-2">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="m3-btn m3-btn-outlined text-xs py-1 px-3 flex items-center gap-1"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
