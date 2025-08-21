import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { MarkdownRenderer, App, Component } from 'obsidian';
import { ITEMS_PER_PAGE } from '../types';
import type { CardData } from '../types';

interface AllCardsComponentProps {
  cards: CardData[];
  allCards: CardData[];
  onDeleteCard: (id: string) => void;
  onResetAllCards: () => void;
  onPageChange: (page: number) => void;
  currentPage: number;
  totalPages: number;
  app: App;
  plugin: Component;
  selectedDirectory: string;
  onDirectorySelect: (dir: string) => void;
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
  onPageChange,
  currentPage,
  totalPages,
  app, 
  plugin,
  selectedDirectory,
  onDirectorySelect
}: AllCardsComponentProps) {
  const [isResetting, setIsResetting] = useState(false);
  const [localPage, setLocalPage] = useState<number>(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // 전체 카드 통계 (현재 페이지가 아닌 전체)
  const total = allCards.length;
  const reviewed = allCards.filter((c: CardData) => c.reviewed).length;
  const unreviewed = allCards.filter((c: CardData) => !c.reviewed).length;

  // 디렉토리 사전과 선택된 디렉토리의 소스 사전 만들기
  const directories = useMemo(() => {
    const map: Record<string, CardData[]> = {};
    // 기본함은 항상 표시
    map['기본함'] = [];
    
    for (const c of allCards) {
      const dir = c.directory || '기본함';
      (map[dir] ||= []).push(c);
    }
    
    return map;
  }, [allCards, refreshTrigger]);

  // 선택 디렉토리의 모든 카드
  const filteredCards = useMemo(() => {
    const result = directories[selectedDirectory] || [];
    return result;
  }, [directories, selectedDirectory]);

  const totalPagesLocal = Math.max(1, Math.ceil(filteredCards.length / ITEMS_PER_PAGE));
  const pagedCards = filteredCards.slice(localPage * ITEMS_PER_PAGE, (localPage + 1) * ITEMS_PER_PAGE);

  // 디렉토리/소스 변경 시 페이지 초기화
  useEffect(() => {
    setLocalPage(0);
  }, [selectedDirectory]);

  // 카드 이동 이벤트 수신
  useEffect(() => {
    const handleMoveComplete = () => {
      setRefreshTrigger(prev => prev + 1);
    };

    window.addEventListener('card-review-move-complete', handleMoveComplete);
    return () => window.removeEventListener('card-review-move-complete', handleMoveComplete);
  }, [selectedDirectory]);

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
        {Object.keys(directories).sort().map((dir) => (
          <div
            class={`directory-tile ${dir === selectedDirectory ? 'all-cards' : ''}`}
            style="cursor: pointer; pointer-events: auto;"
            onClick={(e: MouseEvent) => { 
              e.preventDefault();
              e.stopPropagation();
              onDirectorySelect(dir);
            }}
            onDragOver={(e: DragEvent) => { e.preventDefault(); }}
            onDrop={(e: DragEvent) => {
              try {
                const data = e.dataTransfer?.getData('text/plain');
                if (!data) return;
                // data에는 source 경로가 들어온다고 가정
                const payload = JSON.parse(data);
                if (payload && payload.type === 'source' && payload.source) {
                  // 커스텀 이벤트로 상위에 요청 전달 (플러그인 핸들링)
                  const ev = new CustomEvent('card-review-move-source', { detail: { source: payload.source, dir } });
                  window.dispatchEvent(ev);
                }
              } catch(error) {
                console.error('디렉토리 이동 오류:', error);
				}
            }}
          >
            <div 
              class="directory-title"
              onClick={(e: MouseEvent) => { 
                e.preventDefault();
                e.stopPropagation();
                onDirectorySelect(dir);
              }}
            >
              {dir}
            </div>
          </div>
        ))}
      </div>
      <div class="cards-list">
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
                  onClick={() => setLocalPage(p => {
                    const newPage = Math.max(0, p - 1);
                    onPageChange(newPage);
                    return newPage;
                  })}
                >
                  이전
                </button>
                <span class="pagination-info">
                  {localPage + 1} / {totalPagesLocal}
                </span>
                <button 
                  class="pagination-btn"
                  disabled={localPage === totalPagesLocal - 1}
                  onClick={() => {
                    setLocalPage(p => {
                      const newPage = Math.min(totalPagesLocal - 1, p + 1);
                      onPageChange(newPage);
                      return newPage;
                    });
                  }}
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
