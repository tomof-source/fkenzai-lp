玄関見積LP 会社サーバーへの自動反映

何をするか
genkan-mitsumori/ を直して main に入れると、GitHub Actions が会社サーバーの https://f-kenzai.com/genkan-mitsumori/ を新しい版に差し替える。
GitHub Pages（https://tomof-source.github.io/fkenzai-lp/genkan-mitsumori/）はこれまでどおり別に更新される。

流れ（.github/workflows/deploy-genkan-company.yml）
1. build_genkan.py：data.json の中身を index.html に埋め込み、img/ と一緒に dist/genkan-mitsumori/ へ組み立てる。参照している画像が1枚でも無ければ止まる
2. check_built.mjs：組み立てたものをブラウザで開き、金額が出る・画像が全部出る・横にはみ出さない・申し込み先・電話・LINE がそろっている、を幅390と1280で確かめる。1つでも落ちたら送らない
3. サーバーの今の genkan-mitsumori フォルダを ~/lp_backup/ に固めて控える（直近10回分を残す）
4. 画像を先に、index.html を最後に送る（途中で切れても、古いページが新しい画像を探して欠ける形にしない）。サーバー側の不要ファイルは消さない
5. 公開URLの中身が送ったファイルと同じになったかをハッシュで確かめる

手動で動かす
GitHub の Actions →「玄関見積LPを会社サーバーへ反映」→ Run workflow。

必要な設定（リポジトリの Settings → Secrets and variables → Actions）
Secrets
・XSERVER_SSH_KEY：送信専用の秘密鍵（ed25519・パスフレーズなし）。対になる公開鍵をサーバーパネルの SSH設定 に登録する
Variables
・XSERVER_HOST：SSH の接続先（エックスサーバーのホスト名）
・XSERVER_USER：SSH のユーザー名（サーバーID）
・XSERVER_GENKAN_DIR：サーバー上の genkan-mitsumori フォルダの絶対パス
・XSERVER_KNOWN_HOSTS：サーバーの指紋（ssh-keyscan -p 10022 の結果）。相手が本物かをこれで確かめる
どれか1つでも空なら、組み立てと確認だけして送信はしない（警告が出る）。

戻し方
サーバーの ~/lp_backup/ に genkan-mitsumori_日時.tgz がある。いちばん手軽なのは、GitHub で直前のコミットを revert して main に入れること（同じ流れで前の版が送られる）。
急ぎでサーバーから直接戻すときは、控えの tgz を genkan-mitsumori フォルダの親で展開する。

止め方
Actions の画面でこのワークフローを Disable にする。サーバーのページはそのまま残る。

注意
・サーバーパネルで SSH の「国外アクセス制限」をオンにすると、GitHub（海外）からつなげなくなる
・鍵を作り直したら、サーバーパネルの公開鍵と XSERVER_SSH_KEY の両方を入れ替える
