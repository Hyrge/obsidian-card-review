import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { MarkdownRenderer, App, Component } from 'obsidian';
import type { CardData } from '../types';

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
  onDeleteCard, 
  onResetAllCards, 
  onPageChange,
  currentPage,
  totalPages,
  app, 
  plugin 
}: AllCardsComponentProps) {
  const [isResetting, setIsResetting] = useState(false);
  
  // 전체 카드 통계 (현재 페이지가 아닌 전체)
  const allCards = (plugin as any).cards || [];
  const total = allCards.length;
  const reviewed = allCards.filter((c: any) => c.reviewed).length;
  const unreviewed = allCards.filter((c: any) => !c.reviewed).length;

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
