import { ItemView, WorkspaceLeaf } from 'obsidian';
import { h, render } from 'preact';
import { AllCardsComponent } from '../components/AllCardsComponent';
import type CardReviewPlugin from '../main';

export const ALL_CARDS_VIEW_TYPE = 'all-cards-view';

export class AllCardsView extends ItemView {
  plugin: CardReviewPlugin;
  private currentPage: number = 0;
  private readonly itemsPerPage: number = 50;

  constructor(leaf: WorkspaceLeaf, plugin: CardReviewPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return ALL_CARDS_VIEW_TYPE;
  }

  getDisplayText() {
    return '모든 카드';
  }

  getIcon() {
    return 'cards';
  }

  async onOpen() {
    this.renderCards();
  }

  async onClose() {
    // 정리 작업
  }

  renderCards() {
    const container = this.containerEl.children[1];
    container.empty();

    const handleDeleteCard = async (cardId: string) => {
      try {
        await this.plugin.deleteCard(cardId);
        
        // 현재 페이지의 카드가 모두 삭제되었으면 이전 페이지로 이동
        const currentCards = this.plugin.getCardsByPage(this.currentPage, this.itemsPerPage);
        if (currentCards.length === 0 && this.currentPage > 0) {
          this.currentPage--;
        }
        
        this.renderCards(); // 목록 새로고침
      } catch (error) {
        console.error('카드 삭제 중 오류:', error);
      }
    };

    const handleResetAllCards = async () => {
      try {
        const reviewedCards = this.plugin.cards.filter(card => card.reviewed);
        if (reviewedCards.length === 0) {
          return;
        }
        
        // 리셋 실행
        await this.plugin.resetAllCards();
        
        // 페이지를 0으로 리셋
        this.currentPage = 0;
        
        // 목록 새로고침
        this.renderCards();
      } catch (error) {
        console.error('카드 리셋 중 오류:', error);
      }
    };

    const handlePageChange = (page: number) => {
      this.currentPage = page;
      this.renderCards();
    };

    // 현재 페이지의 카드들만 가져오기
    const currentCards = this.plugin.getCardsByPage(this.currentPage, this.itemsPerPage);
    const totalPages = this.plugin.getTotalPages(this.itemsPerPage);

    render(
      h(AllCardsComponent, {
        cards: currentCards,
        onDeleteCard: handleDeleteCard,
        onResetAllCards: handleResetAllCards,
        onPageChange: handlePageChange,
        currentPage: this.currentPage,
        totalPages: totalPages,
        app: this.app,
        plugin: this.plugin
      }),
      container
    );
  }

  // 플러그인에서 카드가 변경될 때 호출할 메서드
  refresh() {
    this.renderCards();
  }
} 
