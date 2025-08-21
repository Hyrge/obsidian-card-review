import { App, TFile } from 'obsidian';

export interface Block {
	id: string;
	content: string;
	type: 'paragraph' | 'heading' | 'list' | 'blockquote' | 'code' | 'other';
	start: number;
	end: number;
	level?: number; // for headings
}

export class BlockParser {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	async parseFileBlocks(file: TFile): Promise<Block[]> {
		const content = await this.app.vault.read(file);
		return this.parseContentBlocks(content);
	}

	parseContentBlocks(content: string): Block[] {
		const lines = content.split('\n');
		const blocks: Block[] = [];
		let currentBlock: Block | null = null;
		let blockId = 0;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const trimmedLine = line.trim();

			// 빈 줄 처리
			if (trimmedLine === '') {
				if (currentBlock) {
					blocks.push(currentBlock);
					currentBlock = null;
				}
				continue;
			}

			// 새로운 블록 시작 감지
			const blockType = this.detectBlockType(line);
			
			// 기존 블록과 타입이 다르거나 헤딩인 경우 새 블록 생성
			if (!currentBlock || currentBlock.type !== blockType || blockType === 'heading') {
				if (currentBlock) {
					blocks.push(currentBlock);
				}
				
				currentBlock = {
					id: `block-${blockId++}`,
					content: line,
					type: blockType,
					start: i,
					end: i
				};

				// 헤딩 레벨 설정
				if (blockType === 'heading') {
					currentBlock.level = this.getHeadingLevel(line);
				}
			} else {
				// 기존 블록에 추가
				currentBlock.content += '\n' + line;
				currentBlock.end = i;
			}
		}

		// 마지막 블록 추가
		if (currentBlock) {
			blocks.push(currentBlock);
		}

		return blocks.filter(block => block.content.trim().length > 0);
	}

	private detectBlockType(line: string): Block['type'] {
		const trimmed = line.trim();
		
		// 헤딩
		if (trimmed.match(/^#{1,6}\s/)) {
			return 'heading';
		}
		
		// 코드 블록
		if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
			return 'code';
		}
		
		// 인용구
		if (trimmed.startsWith('>')) {
			return 'blockquote';
		}
		
		// 리스트 (순서 있는/없는)
		if (trimmed.match(/^[-*+]\s/) || trimmed.match(/^\d+\.\s/)) {
			return 'list';
		}
		
		// 기본적으로 문단
		return 'paragraph';
	}

	private getHeadingLevel(line: string): number {
		const match = line.trim().match(/^(#{1,6})\s/);
		return match ? match[1].length : 1;
	}

	// 블록 내용을 카드 형태로 정리
	formatBlockForCard(block: Block): string {
		let content = block.content.trim();
		
		// 헤딩의 경우 # 제거
		if (block.type === 'heading') {
			content = content.replace(/^#{1,6}\s*/, '');
		}
		
		// 리스트의 경우 들여쓰기 정리
		if (block.type === 'list') {
			const lines = content.split('\n');
			content = lines.map(line => {
				// 리스트 마커 제거하고 내용만 추출
				return line.replace(/^\s*[-*+]\s*/, '• ').replace(/^\s*\d+\.\s*/, '• ');
			}).join('\n');
		}
		
		// 인용구의 경우 > 제거
		if (block.type === 'blockquote') {
			const lines = content.split('\n');
			content = lines.map(line => line.replace(/^\s*>\s*/, '')).join('\n');
		}
		
		// 코드 블록의 경우 백틱 제거
		if (block.type === 'code') {
			content = content.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');
		}
		
		return content.trim();
	}

	// 파일의 모든 블록을 카드용으로 변환
	async getBlocksForCards(file: TFile): Promise<Array<{ content: string; type: string; id: string }>> {
		const blocks = await this.parseFileBlocks(file);
		
		return blocks
			.filter(block => {
				// 너무 짧은 블록은 제외
				const formatted = this.formatBlockForCard(block);
				return formatted.length >= 10;
			})
			.map(block => ({
				content: this.formatBlockForCard(block),
				type: block.type,
				id: block.id
			}));
	}
}