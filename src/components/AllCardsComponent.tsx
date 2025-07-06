import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { MarkdownRenderer, App, Component } from 'obsidian';

interface CardData {
  id: string;
  text: string;
  source: string;
  createdAt: number;
  reviewed: boolean;
  kept: boolean;
}

interface AllCardsComponentProps {
  cards: CardData[];
  onDeleteCard: (id: string) => void;
  onResetAllCards: () => void;
  onPageChange: (page: number) => void;
  currentPage: number;
  totalPages: number;
  app: App;
  plugin: Component;
}

function CardItem({ card, onDelete, plugin }: { card: CardData; onDelete: (id: string) => void; plugin: Component }) {
  const mdRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mdRef.current) {
      mdRef.current.innerHTML = '';
      MarkdownRenderer.renderMarkdown(card.text, mdRef.current, '', plugin);
    }
  }, [card.text]);

  return (
    <div class="card-item">
      <div class="card-content">
        <div 
          class="card-text markdown-preview-view" 
          ref={mdRef}
          style="margin-bottom: 8px;"
        />
        <div class="card-meta">
          <small>출처: {card.source}</small>
          <small>생성일: {new Date(card.createdAt).toLocaleDateString()}</small>
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
        onClick={() => onDelete(card.id)}
        title="카드 삭제"
      >
        삭제
      </button>
    </div>
  );
}

export function AllCardsComponent({ 
  cards, 
  onDeleteCard, 
  onResetAllCards, 
  onPageChange,
  currentPage,
  totalPages,
  app, 
  plugin 
}: AllCardsComponentProps) {
  // 전체 카드 통계 (현재 페이지가 아닌 전체)
  const allCards = (plugin as any).cards || [];
  const total = allCards.length;
  const reviewed = allCards.filter((c: any) => c.reviewed).length;
  const unreviewed = allCards.filter((c: any) => !c.reviewed).length;

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
            onClick={onResetAllCards}
            disabled={reviewed === 0}
            title="저장된 카드를 모두 리뷰 대기 상태로 돌아가게 합니다"
          >
            {reviewed === 0 ? '리셋할 카드 없음' : '모든 카드 리셋'}
          </button>
        </div>
      </div>

      <div class="cards-list">
        {cards.length === 0 ? (
          <div class="empty-state">
            <p>저장된 카드가 없습니다.</p>
            <p>텍스트를 선택하고 "선택한 텍스트를 카드로 만들기" 명령을 사용해보세요.</p>
          </div>
        ) : (
          <>
            {cards.map(card => (
              <CardItem 
                key={card.id} 
                card={card} 
                onDelete={onDeleteCard} 
                plugin={plugin} 
              />
            ))}
            
            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div class="pagination">
                <button 
                  class="pagination-btn"
                  disabled={currentPage === 0}
                  onClick={() => onPageChange(currentPage - 1)}
                >
                  이전
                </button>
                <span class="pagination-info">
                  {currentPage + 1} / {totalPages}
                </span>
                <button 
                  class="pagination-btn"
                  disabled={currentPage === totalPages - 1}
                  onClick={() => onPageChange(currentPage + 1)}
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
