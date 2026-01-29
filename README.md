# ClearLayer Studio: 高精度ブラウザ背景削除ツール

![ClearLayer Studio UI](./public/demo_screenshot.png)

ClearLayer Studioは、プライバシーを重視したプロフェッショナル仕様のブラウザベース画像編集ツールです。最新のAIモデルを活用し、画像の背景削除やオブジェクト抽出をデバイス上ですべて完結させます。

## 主な機能

- **プロレベルの自動背景削除**: `briaai/RMBG-1.4` と独自の **Ultra-Sharp Guided Filter** (Gamma 2.5) を組み合わせ、ステッカーのようにクッキリとした切り抜きを実現。半透明なフリンジを徹底的に排除します。
- **AIスマート選択 (SAM 2.1)**: 最新の "Segment Anything Model 2.1" を搭載。画像をクリックするだけで、抽出したい範囲を直感的に指定できます。「境界線の滑らかさ」スライダーで仕上がりを微調整可能。
- **クリエイティブ・ツール**:
  - **切り抜きツール**: 必要な範囲を矩形選択して抽出。
  - **手動消しゴム**: ブラシを使って不要な部分を削除。編集内容は即座にダウンロード可能（バグ修正済み）。
- **プライバシー保護**: 画像データがサーバーに送信されることはありません。すべての処理はローカル（WebGPU/WASM）で実行されます。
- **モダンなUI**: Mesh GradientやGlassmorphismを採用した、直感的で美しいインターフェース。

## セキュリティとプライバシー

ClearLayer Studioは、安全なデプロイメントのために以下の対策を講じています。
- **厳格なコンテンツセキュリティポリシー (CSP)**: XSSや不正なデータ流出を防止。
- **Cross-Origin Isolation**: Web Worker間のセキュアな通信とパフォーマンス向上のため、COOP/COEPを設定。
- **Permissions-Policy**: カメラ、マイク、位置情報などのブラウザ権限を完全に遮断。

## 使い方

### 開発環境での実行

1. **依存関係のインストール**:
   ```bash
   npm install
   ```

2. **開発サーバーの起動**:
   ```bash
   npm run dev
   ```

3. **ブラウザで確認**:
   [http://localhost:3000](http://localhost:3000) を開きます。

### デプロイ

静的サイトとしてビルドする場合：

1. **ビルドの実行**:
   ```bash
   npm run build
   ```

2. **出力**:
   `out` ディレクトリに生成されたファイルを、VercelやS3などの静的ホスティングサービスに配置します。

## 技術スタック

- **Frontend**: Next.js 15 (App Router), React 19
- **Styling**: Tailwind CSS 4, Lucide Icons
- **AI Engine**: @huggingface/transformers
- **Models**: 
  - `briaai/RMBG-1.4` (自動削除用 + Ultra-Sharp Alpha Matting)
  - `facebook/sam2.1-hiera-tiny` (スマート選択用)
- **Runtime**: Web Workers + OffscreenCanvas

---
*プライバシーを保護し、高い精度で画像編集を実現します。*
