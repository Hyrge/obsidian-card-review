import { App, Editor, MarkdownView, Notice, Plugin, TFile } from 'obsidian';
import { AllCardsView, ALL_CARDS_VIEW_TYPE } from './views/AllCardsView';
import { PreactCardReviewModal } from './PreactCardReviewModal';
import { CardReviewSettingTab } from './CardReviewSettingTab';
import type { CardData, CardReviewSettings } from './types';
import { DEFAULT_SETTINGS } from './types';

export default class CardReviewPlugin extends Plugin {
	settings!: CardReviewSettings;
	cards: CardData[] = [];
	
	// 캐시 시스템
	private unreviewedCache: CardData[] = [];
	private allCardsCache: CardData[] = [];
	private cacheTimestamp: number = 0;
	private readonly CACHE_DURATION = 5000; // 5초

	async onload() {
		await this.loadSettings();
		await this.loadCards();
		
		// 모바일 전체 너비 모드 적용
		this.applyMobileFullWidth();

		// AllCardsView 등록
		this.registerView(ALL_CARDS_VIEW_TYPE, (leaf) => new AllCardsView(leaf, this));

		// 카드 리뷰 리본 아이콘
		const reviewRibbonIcon = this.addRibbonIcon('play', '카드 리뷰 시작', (evt: MouseEvent) => {
			this.startCardReview();
		});
		
		// 모든 카드 보기 리본 아이콘
		const allCardsRibbonIcon = this.addRibbonIcon('list', '모든 카드 보기', (evt: MouseEvent) => {
			this.openAllCardsView();
		});
		
		// 카드 리셋 리본 아이콘
		const resetRibbonIcon = this.addRibbonIcon('refresh-cw', '모든 카드 리셋', (evt: MouseEvent) => {
			this.resetAllCardsWithNotice();
		});
		
		// 리뷰 대기 카드 수를 표시하는 배지 추가 (카드 리뷰 아이콘에만)
		setTimeout(() => this.updateRibbonBadge(reviewRibbonIcon), 100);

		// 선택한 텍스트를 카드로 만들기 명령어
		this.addCommand({
			id: 'create-card-from-selection',
			name: '선택한 텍스트를 카드로 만들기',
			editorCallback: (editor: Editor, ctx: MarkdownView | any) => {
				const selection = editor.getSelection();
				if (selection.trim().length === 0) {
					new Notice('텍스트를 선택해주세요.');
					return;
				}
				if ('file' in ctx && ctx.file) {
					this.createCard(selection, (ctx.file as TFile)?.path || '알 수 없음');
				} else {
					new Notice('마크다운 파일에서만 사용할 수 있습니다.');
				}
			}
		});

		// 카드 리뷰 시작 명령어
		this.addCommand({
			id: 'start-card-review',
			name: '카드 리뷰',
			callback: () => {
				this.startCardReview();
			}
		});

		// 모든 카드 보기 명령어
		this.addCommand({
			id: 'view-all-cards',
			name: '모든 카드 보기',
			callback: () => {
				this.openAllCardsView();
			}
		});

		// 모든 카드 리셋 명령어
		this.addCommand({
			id: 'reset-all-cards',
			name: '모든 카드 리셋 (다시 리뷰 대기 상태로)',
			callback: async () => {
				const reviewedCards = this.cards.filter(card => card.reviewed);
				if (reviewedCards.length === 0) {
					new Notice('리셋할 카드가 없습니다.');
					return;
				}
				
				await this.resetAllCards();
				new Notice(`${reviewedCards.length}개의 카드가 리뷰 대기 상태로 리셋되었습니다.`);
			}
		});

		// 설정 탭 추가
		this.addSettingTab(new CardReviewSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {
		// 플러그인 언로드 시 정리
	}

	async createCard(text: string, source: string) {
		const card: CardData = {
			id: Date.now().toString(),
			text: text.trim(),
			source: source,
			createdAt: Date.now(),
			reviewed: false,
			kept: false
		};

		this.cards.push(card);
		this.invalidateCache(); // 캐시 무효화
		await this.saveCards();
		
		new Notice(`카드가 생성되었습니다: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
		
		// AllCardsView가 열려있으면 새로고침
		this.refreshAllCardsView();
		
		// 리본 배지 업데이트
		this.updateRibbonBadge();
	}

	async startCardReview() {
		const unreviewed = this.getUnreviewedCards();
		
		if (unreviewed.length === 0) {
			// 리뷰할 카드가 없을 때, 리뷰 완료된 카드가 있는지 확인
			const reviewedCards = this.cards.filter(card => card.reviewed);
			
			if (reviewedCards.length > 0) {
				// 모든 카드를 리셋하여 다시 리뷰 가능하게 함
				await this.resetAllCards();
				new Notice('모든 카드 리뷰가 완료되었습니다! 다시 처음부터 리뷰를 시작합니다.');
				
				// 리셋 후 다시 리뷰 시작
				const resetUnreviewed = this.getUnreviewedCards();
				if (resetUnreviewed.length > 0) {
					new PreactCardReviewModal(this.app, this, resetUnreviewed).open();
				}
			} else {
				new Notice('리뷰할 카드가 없습니다.');
			}
			return;
		}

		new PreactCardReviewModal(this.app, this, unreviewed).open();
	}

	async resetAllCards() {
		// 모든 저장된 카드의 reviewed 상태를 false로 리셋
		this.cards.forEach(card => {
			if (card.kept) {  // 저장된 카드만 리셋 (버려진 카드는 이미 삭제됨)
				card.reviewed = false;
			}
		});
		
		await this.saveCards();
		this.refreshAllCardsView();
		this.updateRibbonBadge();
	}

	async resetAllCardsWithNotice() {
		const reviewedCards = this.cards.filter(card => card.reviewed);
		if (reviewedCards.length === 0) {
			new Notice('리셋할 카드가 없습니다.');
			return;
		}
		
		await this.resetAllCards();
		new Notice(`${reviewedCards.length}개의 카드가 리뷰 대기 상태로 리셋되었습니다.`);
	}

	async openAllCardsView() {
		const existing = this.app.workspace.getLeavesOfType(ALL_CARDS_VIEW_TYPE);
		if (existing.length > 0) {
			// 이미 열려있으면 해당 탭으로 이동
			this.app.workspace.revealLeaf(existing[0]);
		} else {
			// 새로 열기
			await this.app.workspace.getLeaf(true).setViewState({
				type: ALL_CARDS_VIEW_TYPE,
				active: true
			});
		}
	}

	refreshAllCardsView() {
		const leaves = this.app.workspace.getLeavesOfType(ALL_CARDS_VIEW_TYPE);
		leaves.forEach(leaf => {
			if (leaf.view instanceof AllCardsView) {
				// 약간의 지연을 두고 새로고침 (DOM 업데이트 보장)
				setTimeout(() => {
					(leaf.view as AllCardsView).refresh();
				}, 10);
			}
		});
	}

	async saveCard(cardId: string, keep: boolean) {
		const card = this.cards.find(c => c.id === cardId);
		if (card) {
			card.reviewed = true;
			card.kept = keep;
			this.invalidateCache(); // 캐시 무효화
			await this.saveCards();
			this.refreshAllCardsView();
			this.updateRibbonBadge();
		}
	}

	async deleteCard(cardId: string) {
		this.cards = this.cards.filter(c => c.id !== cardId);
		this.invalidateCache(); // 캐시 무효화
		await this.saveCards();
		this.refreshAllCardsView();
		this.updateRibbonBadge();
	}

	async loadCards() {
		const data = await this.loadData();
		this.cards = data?.cards || [];
		this.invalidateCache();
	}

	async saveCards() {
		await this.saveData({ cards: this.cards });
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	applyMobileFullWidth() {
		if (this.settings.mobileFullWidth) {
			document.body.classList.add('mobile-full-width');
		} else {
			document.body.classList.remove('mobile-full-width');
		}
	}

	// 캐시 관리 메서드들
	private invalidateCache() {
		this.unreviewedCache = [];
		this.allCardsCache = [];
		this.cacheTimestamp = 0;
	}

	private getUnreviewedCards(): CardData[] {
		const now = Date.now();
		if (this.unreviewedCache.length === 0 || now - this.cacheTimestamp > this.CACHE_DURATION) {
			this.unreviewedCache = this.cards.filter(card => !card.reviewed);
			this.cacheTimestamp = now;
		}
		return this.unreviewedCache;
	}

	private getAllCards(): CardData[] {
		const now = Date.now();
		if (this.allCardsCache.length === 0 || now - this.cacheTimestamp > this.CACHE_DURATION) {
			this.allCardsCache = [...this.cards];
			this.cacheTimestamp = now;
		}
		return this.allCardsCache;
	}

	// 페이지네이션 메서드
	getCardsByPage(page: number, itemsPerPage: number = 50): CardData[] {
		const allCards = this.getAllCards();
		const start = page * itemsPerPage;
		return allCards.slice(start, start + itemsPerPage);
	}

	getTotalPages(itemsPerPage: number = 50): number {
		return Math.ceil(this.cards.length / itemsPerPage);
	}

	// 리본 아이콘 배지 업데이트
	private updateRibbonBadge(ribbonIcon?: HTMLElement) {
		const unreviewedCount = this.getUnreviewedCards().length;
		
		// 리본 아이콘 찾기
		const icon = ribbonIcon || document.querySelector('.ribbon-icon[aria-label="카드 리뷰"]') as HTMLElement;
		if (!icon) {
			console.log('리본 아이콘을 찾을 수 없습니다');
			return;
		}
		
		// 기존 배지 제거
		const existingBadge = icon.querySelector('.ribbon-badge');
		if (existingBadge) {
			existingBadge.remove();
		}
		
		// 리뷰 대기 카드가 있으면 배지 추가
		if (unreviewedCount > 0) {
			const badge = icon.createEl('div', {
				cls: 'ribbon-badge',
				text: unreviewedCount.toString()
			});
			
			// 배지 스타일 적용
			badge.style.cssText = `
				position: absolute;
				top: -5px;
				right: -5px;
				background: var(--interactive-accent);
				color: white;
				border-radius: 50%;
				width: 18px;
				height: 18px;
				font-size: 10px;
				font-weight: bold;
				display: flex;
				align-items: center;
				justify-content: center;
				z-index: 1;
			`;
		}
	}
}
