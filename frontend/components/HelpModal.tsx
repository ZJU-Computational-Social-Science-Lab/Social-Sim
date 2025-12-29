
import React from 'react';
import { useSimulationStore } from '../store';
import { X, GitBranch, ArrowRight } from 'lucide-react';

export const HelpModal: React.FC = () => {
  const isOpen = useSimulationStore(state => state.isHelpModalOpen);
  const toggle = useSimulationStore(state => state.toggleHelpModal);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <GitBranch className="text-brand-600" size={20} />
            理解 "前沿 (Frontier)" 概念
          </h2>
          <button onClick={() => toggle(false)} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
          {/* #4 Visual explanation of concepts */}
          <section className="grid grid-cols-2 gap-8">
            <div>
               <h3 className="font-bold text-slate-800 mb-2">什么是前沿叶子 (Frontier Leaf)?</h3>
               <p className="text-sm text-slate-600 leading-relaxed mb-4">
                 “前沿叶子”代表了仿真时间线的最新端点。它们是当前没有任何子节点的节点。
               </p>
               <ul className="space-y-2 text-sm text-slate-600">
                 <li className="flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-brand-500"></span>
                   <span>代表潜在的未来发展路径。</span>
                 </li>
                 <li className="flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-brand-500"></span>
                   <span>执行“推进 (Advance)”操作的起点。</span>
                 </li>
               </ul>
            </div>
            <div className="bg-slate-50 border rounded-lg p-6 flex items-center justify-center">
              {/* Simple SVG Illustration */}
              <svg width="200" height="120" viewBox="0 0 200 120">
                <circle cx="100" cy="20" r="8" fill="#cbd5e1" />
                <path d="M100 28 L 60 52" stroke="#cbd5e1" strokeWidth="2" />
                <path d="M100 28 L 140 52" stroke="#cbd5e1" strokeWidth="2" />
                
                <circle cx="60" cy="60" r="8" fill="#cbd5e1" /> {/* Old Leaf */}
                <path d="M60 68 L 60 92" stroke="#cbd5e1" strokeWidth="2" />
                <circle cx="60" cy="100" r="10" fill="#fff" stroke="#0ea5e9" strokeWidth="3" /> {/* Frontier */}
                <text x="60" y="118" textAnchor="middle" fontSize="10" fill="#0ea5e9" fontWeight="bold">前沿节点</text>

                <circle cx="140" cy="60" r="10" fill="#fff" stroke="#0ea5e9" strokeWidth="3" /> {/* Frontier */}
                <text x="140" y="80" textAnchor="middle" fontSize="10" fill="#0ea5e9" fontWeight="bold">前沿节点</text>
              </svg>
            </div>
          </section>

          <section>
            <h3 className="font-bold text-slate-800 mb-4">批量操作说明</h3>
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
               <h4 className="text-sm font-bold text-blue-800 mb-1">批量推进所有前沿</h4>
               <p className="text-xs text-blue-600">
                 此命令会识别所有带有蓝色边框的节点（即叶子节点），并同时让它们向前推进一个回合。
                 这对于并行探索多个“如果...会怎样”的场景非常有用。
               </p>
            </div>
            <div className="flex justify-center my-2 text-slate-400">
              <ArrowRight size={20} className="rotate-90" />
            </div>
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
               <h4 className="text-sm font-bold text-indigo-800 mb-1">仅最深层 (Only Max Depth)</h4>
               <p className="text-xs text-indigo-600">
                 如果勾选此项，系统将仅推进位于仿真树<strong>最深层级</strong>的叶子节点。
                 较短的、已经结束或废弃的分支将被忽略。
               </p>
            </div>
          </section>
        </div>
        
        <div className="p-6 bg-slate-50 border-t flex justify-end">
          <button onClick={() => toggle(false)} className="px-6 py-2 bg-slate-800 text-white rounded-lg text-sm hover:bg-slate-700 font-medium">
            明白了
          </button>
        </div>
      </div>
    </div>
  );
};
