import { App, Editor, MarkdownView, Notice, Plugin, TFile } from 'obsidian';
import { AllCardsView, ALL_CARDS_VIEW_TYPE } from './views/AllCardsView';
import { DirectorySidebarView, DIRECTORY_SIDEBAR_VIEW } from './views/DirectorySidebarView';
import { PreactCardReviewModal } from './PreactCardReviewModal';
import { PreactSourceSelectionModal } from './PreactSourceSelectionModal';
import { CardReviewSettingTab } from './CardReviewSettingTab';
import type { CardData, CardReviewSettings, CurrentDeck } from './types';
import { DEFAULT_SETTINGS } from './types';
import { BlockParser } from './blockUtils';

export default class CardReviewPlugin extends Plugin {
	settings!: CardReviewSettings;
	cards: CardData[] = [];
	currentDeck: CurrentDeck | null = null;
	
	// 캐시 시스템
	private unreviewedCache: CardData[] = [];
	private allCardsCache: CardData[] = [];
	private currentDeckCache: CurrentDeck | null = null;
	private cacheTimestamp: number = 0;
	private deckCacheTimestamp: number = 0;
	private readonly CACHE_DURATION = 5000; // 5초

	// 사용자 생성 디렉토리 목록
	private userDirectories: Set<string> = new Set();

	// 블록 파서
	private blockParser!: BlockParser;

	async onload() {
		await this.loadSettings();
		await this.loadCards();
		await this.loadCurrentDeck();
		
		// 블록 파서 초기화
		this.blockParser = new BlockParser(this.app);
		
		// 모바일 전체 너비 모드 적용
		this.applyMobileFullWidth();

		// AllCardsView 등록
		this.registerView(ALL_CARDS_VIEW_TYPE, (leaf) => new AllCardsView(leaf, this));

		// Directory Sidebar View 등록
		this.registerView(DIRECTORY_SIDEBAR_VIEW, (leaf) => new DirectorySidebarView(leaf, this));

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

		// 디렉토리 사이드바 열기 명령어
		this.addCommand({
			id: 'open-directory-sidebar',
			name: '디렉토리 사이드바 열기',
			callback: () => {
				this.openDirectorySidebar();
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

		// 현재 노트의 모든 블록을 카드로 만들기 명령어
		this.addCommand({
			id: 'create-cards-from-all-blocks',
			name: '현재 노트의 모든 블록을 카드로 만들기',
			editorCallback: async (editor: Editor, ctx: MarkdownView | any) => {
				if (!('file' in ctx) || !ctx.file) {
					new Notice('마크다운 파일에서만 사용할 수 있습니다.');
					return;
				}
				
				await this.createCardsFromAllBlocks(ctx.file as TFile);
			}
		});

		// 설정 탭 추가
		this.addSettingTab(new CardReviewSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => {}, 5 * 60 * 1000));
	}

	onunload() {
		// 플러그인 언로드 시 정리
	}

	async createCard(text: string, source: string) {
		// 소스 경로에서 디렉토리 추출
		const directory = this.getDirectoryFromPath(source);
		
		const card: CardData = {
			id: Date.now().toString(),
			text: text.trim(),
			source: source,
			directory: directory,
			createdAt: Date.now(),
			reviewed: false,
			kept: false
		};

		this.cards.push(card);
		
		// 캐시 무효화
		this.invalidateCache();
		
		// 데이터 저장
		await this.saveCards();
		
		new Notice(`카드가 생성되었습니다: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
		
		// UI 업데이트
		this.refreshAllCardsView();
		this.updateRibbonBadge();
	}

	async createCardsFromAllBlocks(file: TFile) {
		try {
			const blocks = await this.blockParser.getBlocksForCards(file);
			
			if (blocks.length === 0) {
				new Notice('이 파일에서 카드로 만들 수 있는 블록이 없습니다.');
				return;
			}

			const directory = this.getDirectoryFromPath(file.path);
			let createdCount = 0;

			for (const block of blocks) {
				const card: CardData = {
					id: `${Date.now()}-${createdCount}`,
					text: block.content,
					source: file.path,
					directory: directory,
					createdAt: Date.now(),
					reviewed: false,
					kept: false
				};

				this.cards.push(card);
				createdCount++;
				
				// 각 카드 생성 사이에 짧은 지연을 추가하여 고유한 ID 보장
				await new Promise(resolve => setTimeout(resolve, 1));
			}

			// 캐시 무효화
			this.invalidateCache();
			
			// 데이터 저장
			await this.saveCards();
			
			new Notice(`${createdCount}개의 블록이 카드로 생성되었습니다.`);
			
			// UI 업데이트
			this.refreshAllCardsView();
			this.updateRibbonBadge();
			
		} catch (error) {
			console.error('블록을 카드로 변환하는 중 오류 발생:', error);
			new Notice('블록을 카드로 변환하는 중 오류가 발생했습니다.');
		}
	}

	async startCardReview() {
		// 캐시된 현재 덱 상태 확인
		const cachedDeck = this.getCurrentDeck();
		
		// 현재 진행 중인 덱이 있으면 이어서 진행
		if (cachedDeck && cachedDeck.cards.length > cachedDeck.currentIndex) {
			const remainingCards = cachedDeck.cards.slice(cachedDeck.currentIndex);
			new PreactCardReviewModal(this.app, this, remainingCards).open();
			return;
		}

		// 덱이 없거나 모두 완료된 경우, 새로운 덱 생성
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
					this.showSourceSelection(resetUnreviewed);
				}
			} else {
				new Notice('리뷰할 카드가 없습니다.');
			}
			return;
		}

		// 소스 선택 모달 표시
		this.showSourceSelection(unreviewed);
	}

	private showSourceSelection(cards: CardData[]) {
		new PreactSourceSelectionModal(
			this.app, 
			this, 
			cards, 
			(selectedCards) => this.startReviewWithCards(selectedCards)
		).open();
	}

	private async startReviewWithCards(selectedCards: CardData[]) {
		if (selectedCards.length === 0) {
			new Notice('선택된 카드가 없습니다.');
			return;
		}

		// 새로운 덱 생성
		this.currentDeck = {
			cards: selectedCards,
			currentIndex: 0
		};
		
		// 덱 상태 저장 및 캐시 무효화
		await this.saveCurrentDeck();
		this.invalidateDeckCache();

		new PreactCardReviewModal(this.app, this, selectedCards).open();
	}

	async resetAllCards() {
		// 모든 저장된 카드의 reviewed 상태를 false로 리셋
		this.cards.forEach(card => {
			if (card.kept) {  // 저장된 카드만 리셋 (버려진 카드는 이미 삭제됨)
				card.reviewed = false;
			}
		});
		
		// 현재 덱 상태 초기화
		this.currentDeck = null;
		
		await this.saveCards();
		await this.saveCurrentDeck();
		this.invalidateDeckCache();
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

		// 사이드바도 함께 열기
		const rightLeaves = this.app.workspace.getLeavesOfType(DIRECTORY_SIDEBAR_VIEW);
		if (rightLeaves.length === 0) {
			const right = this.app.workspace.getRightLeaf(false);
			await right?.setViewState({ type: DIRECTORY_SIDEBAR_VIEW, active: false });
			this.app.workspace.revealLeaf(right!);
		}
	}

	async openDirectorySidebar() {
		const existing = this.app.workspace.getLeavesOfType(DIRECTORY_SIDEBAR_VIEW);
		if (existing.length > 0) {
			// 이미 열려있으면 해당 탭으로 이동
			this.app.workspace.revealLeaf(existing[0]);
		} else {
			// 새로 열기
			const right = this.app.workspace.getRightLeaf(false);
			await right?.setViewState({ type: DIRECTORY_SIDEBAR_VIEW, active: true });
			this.app.workspace.revealLeaf(right!);
		}
	}

	refreshAllCardsView() {
		try {
			const leaves = this.app.workspace.getLeavesOfType(ALL_CARDS_VIEW_TYPE);
			leaves.forEach(leaf => {
				if (leaf.view instanceof AllCardsView) {
					try {
						// 즉시 새로고침 (지연 제거)
						(leaf.view as AllCardsView).refresh();
					} catch (error) {
						console.error('AllCardsView 새로고침 중 오류:', error);
						// 오류 발생 시 다시 시도
						setTimeout(() => {
							try {
								(leaf.view as AllCardsView).refresh();
							} catch (retryError) {
								console.error('AllCardsView 재시도 새로고침 실패:', retryError);
							}
						}, 100);
					}
				}
			});
		} catch (error) {
			console.error('refreshAllCardsView 전체 오류:', error);
		}
	}

	refreshDirectorySidebar() {
		try {
			const leaves = this.app.workspace.getLeavesOfType(DIRECTORY_SIDEBAR_VIEW);
			leaves.forEach(leaf => {
				if (leaf.view instanceof DirectorySidebarView) {
					try {
						// 안전하게 다시 렌더링
						setTimeout(() => {
							(leaf.view as DirectorySidebarView).refresh();
						}, 10);
					} catch (error) {
						console.error('DirectorySidebar 새로고침 중 오류:', error);
					}
				}
			});
		} catch (error) {
			console.error('refreshDirectorySidebar 전체 오류:', error);
		}
	}

	async saveCard(cardId: string, keep: boolean) {
		const card = this.cards.find(c => c.id === cardId);
		if (card) {
			card.reviewed = true;
			card.kept = keep;
			
			// 현재 덱 상태 업데이트
			if (this.currentDeck) {
				this.currentDeck.currentIndex++;
			}
			
			// 캐시 무효화
			this.invalidateCache();
			this.invalidateDeckCache();
			
			// 데이터 저장
			await this.saveCards();
			if (this.currentDeck) {
				await this.saveCurrentDeck();
			}
			
			// UI 업데이트
			this.refreshAllCardsView();
			this.updateRibbonBadge();
		}
	}

	async deleteCard(cardId: string) {
		this.cards = this.cards.filter(c => c.id !== cardId);
		
		// 현재 덱 상태 업데이트
		if (this.currentDeck) {
			this.currentDeck.currentIndex++;
		}
		
		// 캐시 무효화
		this.invalidateCache();
		this.invalidateDeckCache();
		
		// 데이터 저장
		await this.saveCards();
		if (this.currentDeck) {
			await this.saveCurrentDeck();
		}
		
		// UI 업데이트
		this.refreshAllCardsView();
		this.updateRibbonBadge();
	}

	/**
	 * 특정 소스(노트)의 모든 카드를 지정한 디렉토리로 이동
	 */
	async moveSourceToDirectory(source: string, newDirectory: string) {
		let changed = 0;
		for (const card of this.cards) {
			if (card.source === source && card.directory !== newDirectory) {
				card.directory = newDirectory;
				changed++;
			}
		}
		if (changed === 0) {
			return;
		}
		this.invalidateCache();
		await this.saveCards();
		this.refreshAllCardsView();
		// AllCardsComponent와 DirectorySidebar에 카드 이동 완료 알림
		window.dispatchEvent(new CustomEvent('card-review-move-complete'));
	}

	async loadCards() {
		const data = await this.loadData();
    this.cards = (data?.cards || []).map((card: CardData) => ({
			...card,
			// 기존 카드에 directory 필드가 없으면 기본값 설정
			directory: card.directory || this.getDirectoryFromPath(card.source)
		}));
		this.invalidateCache();
	}

	async loadCurrentDeck() {
		const data = await this.loadData();
		this.currentDeck = data?.currentDeck || null;
		this.invalidateDeckCache();
	}

	async saveCards() {
		const data = await this.loadData();
		await this.saveData({ 
			...data,
			cards: this.cards 
		});
	}

	async saveCurrentDeck() {
		const data = await this.loadData();
		await this.saveData({ 
			...data,
			currentDeck: this.currentDeck 
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// 사용자 디렉토리 관리
	getAllDirectories(): string[] {
		const dirs = new Set<string>(['기본함']);
		for (const c of this.cards) {
			dirs.add(c.directory || '기본함');
		}
		for (const d of this.userDirectories) dirs.add(d);
		return Array.from(dirs).sort();
	}

	async createDirectory(name: string) {
		const safe = name?.trim();
		if (!safe) return;
		this.userDirectories.add(safe);
		await this.saveCards();
		this.refreshAllCardsView();
	}

	async deleteDirectory(name: string) {
		const target = name?.trim();
		if (!target || target === '기본함') return;
		// 해당 디렉토리에 속한 카드들은 기본함으로 이동
		let moved = 0;
		for (const card of this.cards) {
			if ((card.directory || '기본함') === target) {
				card.directory = '기본함';
				moved++;
			}
		}
		// 사용자 생성 디렉토리라면 목록에서 제거
		if (this.userDirectories.has(target)) {
			this.userDirectories.delete(target);
		}
		await this.saveCards();
		this.refreshAllCardsView();
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

	private invalidateDeckCache() {
		this.currentDeckCache = null;
		this.deckCacheTimestamp = 0;
	}

	private getUnreviewedCards(): CardData[] {
		const now = Date.now();
		if (this.unreviewedCache.length === 0 || now - this.cacheTimestamp > this.CACHE_DURATION) {
			let unreviewed = this.cards.filter(card => !card.reviewed);
			
			// 랜덤 모드가 활성화되어 있으면 카드를 섞기
			if (this.settings.randomMode) {
				unreviewed = this.shuffleArray([...unreviewed]);
			}
			
			this.unreviewedCache = unreviewed;
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

	private getCurrentDeck(): CurrentDeck | null {
		const now = Date.now();
		if (this.currentDeckCache === null || now - this.deckCacheTimestamp > this.CACHE_DURATION) {
			this.currentDeckCache = this.currentDeck;
			this.deckCacheTimestamp = now;
		}
		return this.currentDeckCache;
	}

	// 페이지네이션 메서드
	getCardsByPage(page: number, itemsPerPage: number = 50): CardData[] {
		const allCards = this.getAllCards();
		const start = page * itemsPerPage;
		return allCards.slice(start, start + itemsPerPage);
	}

	getTotalPages(itemsPerPage: number = 50): number {
		const total = this.getAllCards().length;
		return Math.max(1, Math.ceil(total / itemsPerPage));
	}

	// 배열을 랜덤하게 섞는 메서드 (Fisher-Yates 알고리즘)
	private shuffleArray<T>(array: T[]): T[] {
		const shuffled = [...array];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}
		return shuffled;
	}

	// 경로에서 디렉토리 추출
	private getDirectoryFromPath(path: string): string {
		if (!path || path === '알 수 없음') {
			return '기본함';
		}
		
		const pathParts = path.split('/');
		if (pathParts.length <= 1) {
			return '기본함';
		}
		
		// 마지막 요소(파일명) 제거하고 디렉토리 경로 반환
		pathParts.pop();
		return pathParts.join('/') || '기본함';
	}

	// 리본 아이콘 배지 업데이트
	private updateRibbonBadge(ribbonIcon?: HTMLElement) {
		const unreviewedCount = this.getUnreviewedCards().length;
		
		// 리본 아이콘 찾기
		const icon = ribbonIcon || document.querySelector('.ribbon-icon[aria-label="카드 리뷰"]') as HTMLElement;
		if (!icon) {
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
