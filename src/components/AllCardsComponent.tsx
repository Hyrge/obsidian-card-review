import { h } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { MarkdownRenderer, App, Component } from 'obsidian';
import { ITEMS_PER_PAGE } from '../types';
import type { CardData } from '../types';

interface AllCardsComponentProps {
  cards: CardData[];
  allCards: CardData[];
  onDeleteCard: (id: string) => void;
  onResetAllCards: () => void;
  onMoveSource: (source: string, dir: string) => void;
  onPageChange: (page: number) => void;
  currentPage: number;
  totalPages: number;
  app: App;
  plugin: Component;
}

function CardItem({ card, onDelete, plugin }: { card: CardData; onDelete: (id: string) => void; plugin: Component }) {
  const mdRef = useRef<HTMLDivElement>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (mdRef.current && card.text) {
      try {
        mdRef.current.innerHTML = '';
        MarkdownRenderer.renderMarkdown(card.text, mdRef.current, '', plugin);
      } catch (error) {
        console.error('마크다운 렌더링 오류:', error);
        if (mdRef.current) {
          mdRef.current.textContent = card.text; // 폴백으로 일반 텍스트 표시
        }
      }
    }
  }, [card.text, card.id]);

  const handleDelete = async () => {
    if (isDeleting) return;
    
    setIsDeleting(true);
    try {
      await onDelete(card.id);
    } catch (error) {
      console.error('카드 삭제 오류:', error);
      setIsDeleting(false);
    }
  };

  return (
    <div class={`card-item ${isDeleting ? 'deleting' : ''}`}>
      <div class="card-content">
        <div 
          class="card-text markdown-preview-view" 
          ref={mdRef}
          style="margin-bottom: 8px;"
        />
        <div class="card-meta">
          <small>출처: {card.source}</small>
          <small>생성일: {new Date(card.createdAt).toLocaleDateString()}</small>
          {card.directory && <small>폴더: {card.directory}</small>}
        </div>
      </div>
      <div class="card-status">
        {card.reviewed ? (
          <span class="status-kept">저장됨</span>
        ) : (
          <span class="status-pending">리뷰 대기</span>
        )}
      </div>
      <button 
        class="mod-warning card-delete-btn" 
        onClick={handleDelete}
        disabled={isDeleting}
        title="카드 삭제"
      >
        {isDeleting ? '삭제 중...' : '삭제'}
      </button>
    </div>
  );
}

export function AllCardsComponent({ 
  cards,
  allCards,
  onDeleteCard, 
  onResetAllCards,
  onMoveSource,
  onPageChange,
  currentPage,
  totalPages,
  app, 
  plugin 
}: AllCardsComponentProps) {
  const [isResetting, setIsResetting] = useState(false);
  const [selectedDirectory, setSelectedDirectory] = useState<string>('기본함');
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [dragSource, setDragSource] = useState<string | null>(null);
  const [localPage, setLocalPage] = useState<number>(0);
  
  // 전체 카드 통계 (현재 페이지가 아닌 전체)
  const total = allCards.length;
  const reviewed = allCards.filter((c: any) => c.reviewed).length;
  const unreviewed = allCards.filter((c: any) => !c.reviewed).length;

  // 디렉토리 사전과 선택된 디렉토리의 소스 사전 만들기
  const directories = useMemo(() => {
    const map: Record<string, CardData[]> = {};
    for (const c of allCards) {
      const dir = c.directory || '기본함';
      (map[dir] ||= []).push(c);
    }
    return map;
  }, [allCards]);

  const sourcesBySelectedDirectory = useMemo(() => {
    const list = directories[selectedDirectory] || [];
    const map: Record<string, CardData[]> = {};
    for (const c of list) {
      (map[c.source] ||= []).push(c);
    }
    return map;
  }, [directories, selectedDirectory]);

  // 선택 상태에 따른 표시 카드 및 페이지네이션 계산
  const filteredCards = useMemo(() => {
    const base = directories[selectedDirectory] || [];
    if (selectedSource) {
      return base.filter(c => c.source === selectedSource);
    }
    return base;
  }, [directories, selectedDirectory, selectedSource]);

  const totalPagesLocal = Math.max(1, Math.ceil(filteredCards.length / ITEMS_PER_PAGE));
  const pagedCards = filteredCards.slice(localPage * ITEMS_PER_PAGE, (localPage + 1) * ITEMS_PER_PAGE);

  // 디렉토리/소스 변경 시 페이지 초기화
  useEffect(() => {
    setLocalPage(0);
  }, [selectedDirectory, selectedSource]);

  const handleResetAllCards = async () => {
    if (isResetting || reviewed === 0) return;
    
    setIsResetting(true);
    try {
      await onResetAllCards();
    } catch (error) {
      console.error('카드 리셋 오류:', error);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div class="all-cards-view">
      <div class="all-cards-header">
        <h2>모든 카드</h2>
        <div class="card-stats">
          <div class="stat-item">
            <span class="stat-number">{total}</span>
            <span class="stat-label">총 카드</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">{reviewed}</span>
            <span class="stat-label">저장된 카드</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">{unreviewed}</span>
            <span class="stat-label">리뷰 대기</span>
          </div>
        </div>
        <div class="card-actions">
          <button 
            class="mod-cta"
            onClick={handleResetAllCards}
            disabled={reviewed === 0 || isResetting}
            title="저장된 카드를 모두 리뷰 대기 상태로 돌아가게 합니다"
          >
            {isResetting ? '리셋 중...' : (reviewed === 0 ? '리셋할 카드 없음' : '모든 카드 리셋')}
          </button>
        </div>
      </div>

      {/* 상단 디렉토리 그리드 */}
      <div class="directory-grid" style="margin-bottom:16px;">
        {/* 새 디렉토리 만들기 */}
        <div
          class="directory-tile create"
          onClick={() => {
            const name = prompt('새 디렉토리 이름을 입력하세요');
            if (name && name.trim().length > 0) {
              onMoveSource('', name.trim()); // 빈 소스는 무시, 뷰 리프레시용
            }
          }}
          title="새 디렉토리 만들기"
        >
          <div class="directory-title">+ 새 디렉토리</div>
        </div>

        {Object.keys(directories).sort().map((dir) => (
          <div
            class={`directory-tile ${dir === selectedDirectory ? 'all-cards' : ''}`}
            onClick={() => { setSelectedDirectory(dir); setSelectedSource(null); }}
            onDragOver={(e: any) => { if (dragSource) e.preventDefault(); }}
            onDrop={() => { if (dragSource) { onMoveSource(dragSource, dir); setSelectedSource(null); } }}
          >
            <div class="directory-title">{dir}</div>
          </div>
        ))}
      </div>

      {/* 선택된 디렉토리의 소스 리스트 + 드래그로 디렉토리 이동 */}
      <div class="cards-list">
        {Object.keys(sourcesBySelectedDirectory).length > 0 && (
          <>
            {Object.entries(sourcesBySelectedDirectory).map(([source, sourceCards]) => (
              <div
                class={`card-item ${selectedSource === source ? 'selected' : ''}`}
                draggable={true}
                onDragStart={() => setDragSource(source)}
                onDragEnd={() => setDragSource(null)}
                onClick={() => setSelectedSource(source)}
                title="이 소스를 드래그해서 다른 디렉토리로 이동할 수 있습니다"
              >
                <div class="card-content">
                  <div class="card-text" style="margin-bottom:4px;">{source}</div>
                  <div class="card-meta">
                    <small>{sourceCards.length}개의 카드</small>
                    <small>현재 디렉토리: {selectedDirectory}</small>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* 드랍존: 디렉토리 타일에 드롭 시 이동 */}
        <div style="display:none" />

        {pagedCards.length === 0 ? (
          <div class="empty-state">
            <p>저장된 카드가 없습니다.</p>
            <p>텍스트를 선택하고 "선택한 텍스트를 카드로 만들기" 명령을 사용해보세요.</p>
          </div>
        ) : (
          <>
            {pagedCards.map(card => (
              <CardItem 
                key={card.id} 
                card={card} 
                onDelete={onDeleteCard} 
                plugin={plugin} 
              />
            ))}
            
            {/* 페이지네이션 */}
            {totalPagesLocal > 1 && (
              <div class="pagination">
                <button 
                  class="pagination-btn"
                  disabled={localPage === 0}
                  onClick={() => { setLocalPage(p => Math.max(0, p - 1)); onPageChange(localPage - 1); }}
                >
                  이전
                </button>
                <span class="pagination-info">
                  {localPage + 1} / {totalPagesLocal}
                </span>
                <button 
                  class="pagination-btn"
                  disabled={localPage === totalPagesLocal - 1}
                  onClick={() => { setLocalPage(p => Math.min(totalPagesLocal - 1, p + 1)); onPageChange(localPage + 1); }}
                >
                  다음
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 
