import { h } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type CardReviewPlugin from '../main';
import type { CardData } from '../types';

interface DirectorySidebarProps {
	plugin: CardReviewPlugin;
}

export function DirectorySidebar({ plugin }: DirectorySidebarProps) {
	const [newDir, setNewDir] = useState('');
	const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(['기본함']));
	const [refreshTrigger, setRefreshTrigger] = useState(0);

	const directories = useMemo(() => plugin.getAllDirectories(), [plugin.cards, refreshTrigger]);

	const dirToSources = useMemo(() => {
		const map = new Map<string, Set<string>>();
		for (const d of directories) map.set(d, new Set<string>());
		for (const c of plugin.cards as CardData[]) {
			const dir = (c.directory || '기본함');
			if (!map.has(dir)) map.set(dir, new Set<string>());
			if (c.source) map.get(dir)!.add(c.source);
		}
		return map;
	}, [directories, plugin.cards]);

    const sources = useMemo(() => {
        const set = new Set<string>();
        for (const c of plugin.cards as CardData[]) {
            if (c.source) set.add(c.source);
        }
        return Array.from(set).sort();
    }, [plugin.cards]);

	const handleCreate = async () => {
		const name = newDir.trim();
		if (!name) return;
		try {
			await plugin.createDirectory(name);
			setNewDir('');
			setRefreshTrigger(prev => prev + 1);
		} catch (error) {
			console.error('디렉토리 생성 오류:', error);
		}
	};

	const handleDelete = async (name: string) => {
		if (name === '기본함') return;
		try {
			await plugin.deleteDirectory(name);
			setRefreshTrigger(prev => prev + 1);
		} catch (error) {
			console.error('디렉토리 삭제 오류:', error);
		}
	};

    useEffect(() => {
        const onMove = async (e: Event) => {
            const detail = (e as CustomEvent).detail as { source?: string; dir?: string } | undefined;
            const { source, dir } = detail || {};
            if (source && dir) {
                await plugin.moveSourceToDirectory(source, dir);
            }
        };
        window.addEventListener('card-review-move-source', onMove as EventListener);
        return () => window.removeEventListener('card-review-move-source', onMove as EventListener);
    }, [plugin]);

    // 카드 이동 완료 시 UI 새로고침
    useEffect(() => {
        const handleMoveComplete = () => {
            setRefreshTrigger(prev => prev + 1);
        };
        
        window.addEventListener('card-review-move-complete', handleMoveComplete);
        return () => window.removeEventListener('card-review-move-complete', handleMoveComplete);
    }, []);

	return (
		<div class="directory-sidebar" style="padding:12px; display:flex; flex-direction:column; gap:12px;">
			<div style="display:flex; gap:8px;">
				<input
					value={newDir}
					onInput={(e: any) => setNewDir(e.currentTarget.value)}
					placeholder="새 디렉토리 이름"
					style="flex:1;"
				/>
				<button onClick={handleCreate}>추가</button>
			</div>

			<div style="display:flex; flex-direction:column; gap:6px; max-height:460px; overflow:auto;">
				{directories.map((d) => {
					const isExpanded = expandedDirs.has(d);
					const dirSources = Array.from(dirToSources.get(d) || []);
					return (
						<div>
							<div 
								style="display:flex; align-items:center; justify-content:space-between; gap:8px; padding:6px 8px; border:1px solid var(--background-modifier-border); border-radius:6px; cursor:pointer;"
								onClick={() => {
									const next = new Set(expandedDirs);
									if (isExpanded) next.delete(d); else next.add(d);
									setExpandedDirs(next);
								}}
								onDragOver={(e: any) => e.preventDefault()}
								onDrop={async (e: any) => {
									try {
										const data = e.dataTransfer.getData('text/plain');
										const payload = JSON.parse(data);
										if (payload && payload.type === 'source' && payload.source) {
											await plugin.moveSourceToDirectory(payload.source, d);
										}
									} catch {}
								}}
							>
								<span style="display:flex; align-items:center; gap:8px;">
									<span style="width:10px; text-align:center;">{isExpanded ? '▾' : '▸'}</span>
									<strong>{d}</strong>
									<small style="color:var(--text-muted)">{dirSources.length}</small>
								</span>
								<button disabled={d==='기본함'} onClick={(e: any) => { e.stopPropagation(); handleDelete(d); }}>삭제</button>
							</div>
							{isExpanded && dirSources.length > 0 && (
								<div style="margin-left:18px; display:flex; flex-direction:column; gap:6px; padding-top:4px;">
									{dirSources.map(s => (
										<div draggable={true}
										 	onDragStart={(e: any) => {
										 		e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'source', source: s }));
										 	}}
										 	style="padding:6px 8px; border:1px dashed var(--background-modifier-border); border-radius:6px; cursor:grab;">
											{s}
										</div>
									))}
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}

