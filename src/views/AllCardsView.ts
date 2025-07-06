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
      await this.plugin.deleteCard(cardId);
      this.renderCards(); // 목록 새로고침
    };

    const handleResetAllCards = async () => {
      const reviewedCards = this.plugin.cards.filter(card => card.reviewed);
      if (reviewedCards.length === 0) {
        return;
      }
      await this.plugin.resetAllCards();
      this.renderCards(); // 목록 새로고침
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
