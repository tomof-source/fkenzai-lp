玄関見積LP 会社サーバーへの自動反映

何をするか
genkan-mitsumori/ を直して main に入れると、GitHub Actions が会社サーバーの https://f-kenzai.com/genkan-mitsumori/ を新しい版に差し替える。
GitHub Pages（https://tomof-source.github.io/fkenzai-lp/genkan-mitsumori/）はこれまでどおり別に更新される。
サーバーパネル（SSH設定・公開鍵）はTASARTさんの管理。TASARTさんに頼むのは鍵を入れ替えるときと、緊急で止めるときだけ。

流れ（.github/workflows/deploy-genkan-company.yml）
1. build_genkan.py：data.json の中身を index.html に埋め込み、img/ と一緒に dist/genkan-mitsumori/ へ組み立てる。参照している画像が1枚でも無ければ止まる
   会社サーバーは画像を7日間キャッシュさせるので、画像の参照に中身の指紋（img/…jpg?v=ハッシュ）を付ける。同じ名前の写真を差し替えても、閲覧者にはすぐ新しい写真が出る
2. check_built.mjs：組み立てたものをブラウザで開き、金額が出る（10万〜300万円の範囲）・画像が全部出る・横にはみ出さない・申し込み先・電話・LINE がそろっている、を幅390と1280で確かめる。1つでも落ちたら送らない
3. サーバーの今の genkan-mitsumori フォルダを ~/lp_backup/ に固めて控える
   ・genkan-mitsumori_original.tgz：TASARTさんが最初に置いた版。消さない
   ・genkan-mitsumori_日時.tgz：送るたびの控え。直近10回分を残す（1回あたり約20MB。写真が約22MBあり、jpg はほとんど縮まないため）
4. 画像を先に、index.html を最後に送る（rsync。途中で切れても古いページが欠けた画像を探す形にしない）。サーバー側の不要ファイル（古い data.json など）は消さない
5. verify_public.py：公開URLの index.html が送ったものと同じか、参照している画像が全部 200 で返るかを外から確かめる（画像の確認に数分かかる。全体で10分前後）
6. 3〜5 のどこかで落ちたら、その回の控えから自動で戻し、公開ページが控えと同じになったかも確かめる

止まる・送らないとき
・main 以外のブランチからは送らない（Run workflow でブランチを選んでも送らない）
・main に入れたのにサーバーの設定（下の5つ）のどれかが空なら、赤（失敗）で止まる。Run workflow から動かしたときだけ、送らずに緑で終わる
・XSERVER_GENKAN_DIR が /home/…/public_html/genkan-mitsumori の形でない、またはそのフォルダがサーバーに無いときは送らない

失敗したら
・GitHub から、main に入れた人（または Run workflow を押した人）へ失敗のメールが届く（GitHub の通知設定で Actions の通知を切っていると届かない。届くかは未確認なので、main に入れたあとは Actions の画面で緑か赤かを1回見る）
・Actions の画面で赤い実行を開き、どの段で落ちたかを見る
　・「組み立て」「送る前にブラウザで確認」で落ちた：サーバーには何も送っていない。書いてある理由（画像が無い・金額が出ない等）を直して main に入れ直す
　・「送る」「公開URLで確認」で落ちた：最後の段で、送る前の版へ自動で戻している。ログに「戻しました（公開URLで一致を確認）」と出ていれば、お客様には前の版が見えている。原因を直して入れ直す
　・ログに「控えと一致しません」と出た：戻しがうまくいっていない。公開ページを開いて表示を確かめ、下の「サーバーから直接戻すとき」で戻すか、SSH が使えなければTASARTさんに控え（~/lp_backup）からの復元を頼む
　・SSH でつながらない：TASARTさんにSSH設定がオンのままか、公開鍵が登録されたままか、国外アクセス制限がオフかを確認してもらう

手動で動かす
GitHub の Actions →「玄関見積LPを会社サーバーへ反映」→ Run workflow（main を選ぶ）。

戻し方
・ふつうは、GitHub で戻したいコミットを revert して main に入れる。同じ流れで前の版が送られる
・サーバーから直接戻すとき（SSH が使える人）：
　tar xzf ~/lp_backup/genkan-mitsumori_日時.tgz -C /home/<サーバーID>/f-kenzai.com/public_html
　最初の版に戻すなら genkan-mitsumori_original.tgz を同じように展開する

止め方
・自動の送信だけ止める：Actions の画面でこのワークフローを Disable にする。サーバーのページはそのまま残る
・緊急（鍵が漏れた疑いなど）：TASARTさんにサーバーパネルの「公開鍵登録・更新」から fkenzai-lp-deploy の公開鍵を消してもらう。これでGitHubからは一切つながらなくなる。あわせて Secrets の XSERVER_SSH_KEY も消す

鍵について（大事）
・この鍵は会社サーバーのアカウント全体に届く（WordPress を含むサイト全体を書き換えられる）。エックスサーバーの公開鍵には「このフォルダだけ」という制限を付けられない
・秘密の側は事務所PCの C:\Users\fkenz\.ssh\fkenzai_lp_deploy と、GitHub の Secrets の2か所だけ。メール・チャット・リポジトリに貼らない
・このリポジトリは公開なので、Secrets を扱えるのは書き込み権限のある人だけ（いまは tomof-source のみ）。協力者を増やすときは、この鍵に届くことを前提に判断する
・鍵を作り直したら、TASARTさんに公開鍵の入れ替えを頼み、Secrets の XSERVER_SSH_KEY も入れ替える

必要な設定（リポジトリの Settings → Secrets and variables → Actions）
すべて Secrets に置く（このリポジトリは公開なので、Variables に置くと実行ログに接続先がそのまま出る。Secrets ならログでは *** に伏せられる）
・XSERVER_SSH_KEY：送信用の秘密鍵（ed25519・パスフレーズなし）
・XSERVER_HOST：SSH の接続先（エックスサーバーのホスト名）
・XSERVER_USER：SSH のユーザー名（サーバーID）
・XSERVER_GENKAN_DIR：サーバー上の genkan-mitsumori フォルダの絶対パス
・XSERVER_KNOWN_HOSTS：サーバーの指紋（ssh-keyscan -p 10022 <ホスト名> の結果）。相手が本物かをこれで確かめる
　サーバーの引っ越しなどで指紋が変わると「Host key verification failed」で止まる。TASARTさんにサーバーが変わったかを確かめてから取り直す

手元で試す
python3 tools/company-deploy/build_genkan.py
npm i --no-save playwright@1.56.1 && npx playwright install chromium
node tools/company-deploy/check_built.mjs dist/genkan-mitsumori
（dist/ は .gitignore 済み。公開URLの確認は送ったあとにしか意味がないので手元では使わない）
