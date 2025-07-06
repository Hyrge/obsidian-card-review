export interface CardData {
	id: string;
	text: string;
	source: string;
	createdAt: number;
	reviewed: boolean;
	kept: boolean;
}

export interface CardReviewSettings {
	autoSave: boolean;
	reviewBatchSize: number;
	mobileFullWidth: boolean;
}

export interface CardPage {
	page: number;
	cards: CardData[];
	total: number;
	hasMore: boolean;
}

export const DEFAULT_SETTINGS: CardReviewSettings = {
	autoSave: true,
	reviewBatchSize: 10,
	mobileFullWidth: false
};

// 카드 목록을 페이지 단위로 로드
export const ITEMS_PER_PAGE = 20; 
