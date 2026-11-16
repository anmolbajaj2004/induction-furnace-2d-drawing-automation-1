import React, { useState } from 'react';
import { ComponentAssemblyGroup, SubComponentDimension } from '../types/furnace';
import { Layers, ChevronDown, ChevronRight, Cpu, Flame, Zap, ArrowUpRight, ArrowDownRight, Search, FileText } from 'lucide-react';

interface AssemblyBreakdownViewProps {
  assemblyGroups: ComponentAssemblyGroup[];
}

export const AssemblyBreakdownView: React.FC<AssemblyBreakdownViewProps> = ({
  assemblyGroups,
}) => {
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>('group_shell');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  const toggleGroup = (id: string) => {
    setExpandedGroupId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 font-mono">
            STEP 4 OF 4
          </span>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mt-0.5">
            <Layers className="w-5 h-5 text-amber-500" />
            New Design Calculated Dimension Schedule (Assemblies & Sub-Components)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Full hierarchical breakdown of calculated dimensions for every component, sub-component, and detail part.
          </p>
        </div>

        {/* Filter / Search Bar */}
        <div className="flex items-center gap-3">
          
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search component..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white"
            />
          </div>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            <option value="Assembly">Assemblies</option>
            <option value="Sub-Component">Sub-Components</option>
            <option value="Detail Part">Detail Parts</option>
          </select>

        </div>
      </div>

      {/* Accordion / List of Assembly Groups */}
      <div className="space-y-4">
        {assemblyGroups.map((group) => {
          const isExpanded = expandedGroupId === group.id || searchQuery.length > 0;

          // Filter sub-components by search query & category filter
          const filteredSubComponents = group.subComponents.filter((sub) => {
            const matchesSearch =
              sub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              sub.layer.toLowerCase().includes(searchQuery.toLowerCase()) ||
              sub.notes.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = filterCategory === 'ALL' || sub.category === filterCategory;
            return matchesSearch && matchesCategory;
          });

          if (searchQuery.length > 0 && filteredSubComponents.length === 0) {
            return null;
          }

          return (
            <div
              key={group.id}
              className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden transition-all bg-slate-50/50 dark:bg-slate-950/50"
            >
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-100/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    {group.type === 'SHELL_MECHANICAL' ? (
                      <Layers className="w-5 h-5 text-blue-500" />
                    ) : group.type === 'CHOCK_ELECTRICAL' ? (
                      <Cpu className="w-5 h-5 text-amber-500" />
                    ) : group.type === 'CRUCIBLE_THERMAL' ? (
                      <Flame className="w-5 h-5 text-rose-500" />
                    ) : (
                      <Zap className="w-5 h-5 text-emerald-500" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {group.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {group.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-mono text-slate-500 bg-slate-200 dark:bg-slate-800 px-2.5 py-0.5 rounded-full font-semibold">
                    {filteredSubComponents.length} Parameters
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </button>

              {/* Group Content Table */}
              {isExpanded && (
                <div className="border-t border-slate-200 dark:border-slate-800 overflow-x-auto bg-white dark:bg-slate-900">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Component / Detail Name</th>
                        <th className="px-4 py-3 font-semibold">CAD Layer</th>
                        <th className="px-4 py-3 font-semibold text-right">Reference Drawing</th>
                        <th className="px-4 py-3 font-semibold text-right">New Design Value</th>
                        <th className="px-4 py-3 font-semibold text-right">Delta (%)</th>
                        <th className="px-4 py-3 font-semibold">Scaling Mathematical Formula</th>
                        <th className="px-4 py-3 font-semibold">Material / Engineering Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-slate-800 dark:text-slate-200">
                      {filteredSubComponents.map((sub) => (
                        <tr
                          key={sub.id}
                          className="hover:bg-amber-500/5 dark:hover:bg-amber-500/10 transition-colors"
                        >
                          <td className="px-4 py-3 font-sans font-semibold text-slate-900 dark:text-white">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold ${
                                  sub.category === 'Assembly'
                                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                    : sub.category === 'Sub-Component'
                                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                    : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                {sub.category}
                              </span>
                              <span>{sub.name}</span>
                            </div>
                          </td>

                          <td className="px-4 py-3 text-[10px]">
                            <span className="font-bold text-amber-600 dark:text-amber-400">
                              {sub.layer}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400 tabular-nums">
                            {sub.referenceValueMm} {sub.unit}
                          </td>

                          <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white tabular-nums text-sm">
                            {sub.newValueMm} <span className="text-xs font-normal text-slate-400">{sub.unit}</span>
                          </td>

                          <td className="px-4 py-3 text-right">
                            <span
                              className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${
                                sub.deltaPercent >= 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-500'
                              }`}
                            >
                              {sub.deltaPercent >= 0 ? (
                                <ArrowUpRight className="w-3 h-3" />
                              ) : (
                                <ArrowDownRight className="w-3 h-3" />
                              )}
                              {sub.deltaPercent > 0 ? `+${sub.deltaPercent}%` : `${sub.deltaPercent}%`}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-[11px] text-slate-600 dark:text-slate-400">
                            <code className="bg-slate-100 dark:bg-slate-950 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300">
                              {sub.scalingFormula}
                            </code>
                          </td>

                          <td className="px-4 py-3 font-sans text-slate-500 dark:text-slate-400 text-[11px]">
                            {sub.notes}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
};
