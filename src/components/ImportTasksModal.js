import React, { useState, useCallback } from 'react';
import { X, Upload, FileText, Check, AlertTriangle, ChevronRight, ChevronLeft, FileUp } from 'lucide-react';
import { importAPI } from '../services/api';

const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const VALID_STATUSES = ['todo', 'in_progress', 'in_review', 'done'];

export default function ImportTasksModal({ projectId, onClose, onImportComplete }) {
  const [step, setStep] = useState(1);

  // Step 1 state
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Step 2 state
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [systemFields, setSystemFields] = useState([]);
  const [mappings, setMappings] = useState({});

  // Step 3 state
  const [selectedRows, setSelectedRows] = useState([]);
  const [warnings, setWarnings] = useState([]);

  // Step 4 state
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');

  const stepLabels = ['Upload File', 'Map Fields', 'Preview', 'Results'];

  // --- Step 1: Upload ---
  const handleFile = useCallback(async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'json'].includes(ext)) {
      setUploadError('Please upload a .csv or .json file');
      return;
    }
    try {
      setUploading(true);
      setUploadError('');
      const result = await importAPI.parseFile(file);
      setColumns(result.columns);
      setRows(result.rows);
      setSystemFields(result.systemFields);
      // Build mappings from suggestedMappings
      const initialMappings = {};
      if (result.suggestedMappings) {
        Object.entries(result.suggestedMappings).forEach(([col, field]) => {
          initialMappings[col] = field;
        });
      }
      setMappings(initialMappings);
      setStep(2);
    } catch (err) {
      setUploadError(err.message || 'Failed to parse file');
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  // --- Step 2: Mapping ---
  const handleMappingChange = (column, field) => {
    setMappings((prev) => ({ ...prev, [column]: field }));
  };

  const hasTitleMapping = Object.values(mappings).includes('title');

  const goToPreview = () => {
    // Build preview rows and detect warnings
    const newWarnings = [];
    const previewRows = rows.map((row, idx) => {
      const mapped = {};
      Object.entries(mappings).forEach(([col, field]) => {
        if (field && field !== '__skip__') {
          mapped[field] = row[col];
        }
      });

      // Validate priority
      if (mapped.priority && !VALID_PRIORITIES.includes(mapped.priority?.toLowerCase())) {
        newWarnings.push({ row: idx, message: `Row ${idx + 1}: Invalid priority "${mapped.priority}"` });
      }
      // Validate status
      if (mapped.status && !VALID_STATUSES.includes(mapped.status?.toLowerCase())) {
        newWarnings.push({ row: idx, message: `Row ${idx + 1}: Invalid status "${mapped.status}"` });
      }
      // Check parent_task reference
      if (mapped.parent_task) {
        const parentExists = rows.some((r) => {
          const titleCol = Object.entries(mappings).find(([, f]) => f === 'title')?.[0];
          return titleCol && r[titleCol] === mapped.parent_task;
        });
        if (!parentExists) {
          newWarnings.push({ row: idx, message: `Row ${idx + 1}: Parent task "${mapped.parent_task}" not found` });
        }
      }
      return mapped;
    });

    setWarnings(newWarnings);
    setSelectedRows(previewRows.map((_, idx) => idx));
    setStep(3);
  };

  // --- Step 3: Preview ---
  const getMappedRows = () => {
    return rows.map((row) => {
      const mapped = {};
      Object.entries(mappings).forEach(([col, field]) => {
        if (field && field !== '__skip__') {
          mapped[field] = row[col];
        }
      });
      return mapped;
    });
  };

  const mappedRows = step === 3 ? getMappedRows() : [];

  const toggleRow = (idx) => {
    setSelectedRows((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const selectAll = () => setSelectedRows(mappedRows.map((_, idx) => idx));
  const deselectAll = () => setSelectedRows([]);

  const handleImport = async () => {
    try {
      setImporting(true);
      setImportError('');
      const selectedData = selectedRows.map((idx) => rows[idx]);
      const result = await importAPI.execute({
        projectId,
        mappings,
        rows: selectedData,
      });
      setImportResult(result);
      setStep(4);
    } catch (err) {
      setImportError(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    if (step === 4 && importResult?.created > 0) {
      onImportComplete();
    }
    onClose();
  };

  // --- Render ---
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Import Tasks</h2>
            <p className="text-sm text-gray-500 mt-1">
              Step {step} of 4 — {stepLabels[step - 1]}
            </p>
          </div>
          <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 pt-4">
          <div className="flex items-center gap-2">
            {stepLabels.map((label, idx) => (
              <React.Fragment key={label}>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      idx + 1 < step
                        ? 'bg-green-100 text-green-700'
                        : idx + 1 === step
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {idx + 1 < step ? <Check className="w-4 h-4" /> : idx + 1}
                  </div>
                  <span
                    className={`text-sm hidden sm:inline ${
                      idx + 1 === step ? 'text-gray-900 font-medium' : 'text-gray-400'
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {idx < stepLabels.length - 1 && (
                  <div className={`flex-1 h-px ${idx + 1 < step ? 'bg-green-300' : 'bg-gray-200'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Upload */}
          {step === 1 && (
            <div>
              {uploadError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                  {uploadError}
                </div>
              )}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                  dragActive
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-600">Parsing file...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <FileUp className="w-12 h-12 text-gray-400" />
                    <div>
                      <p className="text-gray-700 font-medium">
                        Drag and drop your file here
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        or click to browse
                      </p>
                    </div>
                    <label className="mt-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors cursor-pointer">
                      <span>Choose File</span>
                      <input
                        type="file"
                        accept=".csv,.json"
                        className="hidden"
                        onChange={(e) => handleFile(e.target.files[0])}
                      />
                    </label>
                    <p className="text-xs text-gray-400 mt-2">
                      Supports .csv and .json files
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Field Mapping */}
          {step === 2 && (
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Map your file columns to task fields. At least one column must be mapped to "Title".
              </p>
              {!hasTitleMapping && (
                <div className="bg-orange-50 border border-orange-200 text-orange-700 px-4 py-3 rounded mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm">You must map at least one column to "Title" to proceed.</span>
                </div>
              )}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">File Column</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Map To</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {columns.map((col) => (
                      <tr key={col} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-900">{col}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={mappings[col] || '__skip__'}
                            onChange={(e) => handleMappingChange(col, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="__skip__">-- Skip --</option>
                            {systemFields.map((field) => (
                              <option key={field.value} value={field.value}>
                                {field.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between mt-6">
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={goToPreview}
                  disabled={!hasTitleMapping}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 3 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-600">
                  Select the tasks you want to import ({selectedRows.length} of {mappedRows.length} selected)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={selectAll}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    Select All
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={deselectAll}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {warnings.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 text-orange-700 px-4 py-3 rounded mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm font-medium">Validation Warnings</span>
                  </div>
                  <ul className="text-sm ml-6 list-disc">
                    {warnings.map((w, idx) => (
                      <li key={idx}>{w.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {importError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                  {importError}
                </div>
              )}

              <div className="border border-gray-200 rounded-lg overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={selectedRows.length === mappedRows.length && mappedRows.length > 0}
                          onChange={() =>
                            selectedRows.length === mappedRows.length ? deselectAll() : selectAll()
                          }
                          className="rounded border-gray-300"
                        />
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Title</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Description</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Priority</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Status</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Parent Task</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {mappedRows.map((row, idx) => (
                      <tr
                        key={idx}
                        className={`hover:bg-gray-50 ${selectedRows.includes(idx) ? '' : 'opacity-50'}`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedRows.includes(idx)}
                            onChange={() => toggleRow(idx)}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className={`px-4 py-3 text-sm text-gray-900 ${row.parent_task ? 'pl-8' : ''}`}>
                          {row.title || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate">
                          {row.description || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {row.priority || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {row.status || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {row.parent_task || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between mt-6">
                <button
                  onClick={() => setStep(2)}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={selectedRows.length === 0 || importing}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {importing ? 'Importing...' : `Import Selected (${selectedRows.length} tasks)`}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Results */}
          {step === 4 && importResult && (
            <div>
              <div className="text-center py-6">
                {importResult.created > 0 && (
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <Check className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                )}
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Import Complete</h3>
                <p className="text-gray-600">
                  {importResult.created} task{importResult.created !== 1 ? 's' : ''} created successfully
                  {importResult.failed > 0 && (
                    <span className="text-red-600">
                      , {importResult.failed} task{importResult.failed !== 1 ? 's' : ''} failed
                    </span>
                  )}
                </p>
              </div>

              {importResult.errors && importResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm font-medium">Error Details</span>
                  </div>
                  <ul className="text-sm ml-6 list-disc">
                    {importResult.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end mt-6">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
