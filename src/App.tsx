import { useEffect, useMemo, useRef, useState } from 'react';
import { CreditCard, Loader2, MapPin, RefreshCw, ScanLine, Sparkles, X } from 'lucide-react';
import Layout, { type TabKey } from './components/Layout';
import BarcodeCard from './components/BarcodeCard';
import StoreDetector from './components/StoreDetector';
import PaymentRankCard from './components/PaymentRankCard';
import AffiliatePromoCard from './components/AffiliatePromoCard';
import CardSelectorModal from './components/CardSelectorModal';
import Onboarding from './components/Onboarding';
import PackManager from './components/PackManager';
import { useAppStore } from './store/useAppStore';
import { calculateRewards, currentMonth } from './utils/rewardEngine';
import type { CalculatedRewardResult } from './types';
import { buildRuleReportUrl } from './utils/issueReport';
import { isStandalone } from './utils/deepLink';
import { CHANNEL_MEMBER_CARD_MAP } from './utils/carriers';

/**
 * 把已排序的結果依名次分組，並列（同名次）的會在同一組裡。
 * 引擎已經算好 rank，這裡只是單純依照連續的相同 rank 分堆，
 * 不重新判斷誰跟誰並列——判斷邏輯留在 rewardEngine，這裡只負責分組顯示。
 */
function groupByRank(ranked: CalculatedRewardResult[]): { rank: number; items: CalculatedRewardResult[] }[] {
  const groups: { rank: number; items: CalculatedRewardResult[] }[] = [];
  for (const item of ranked) {
    const last = groups[groups.length - 1];
    if (last && last.rank === item.rank) {
      last.items.push(item);
    } else {
      groups.push({ rank: item.rank, items: [item] });
    }
  }
  return groups;
}

export default function App() {
  const [tab, setTab] = useState<TabKey>('pay');
  const [walletOpen, setWalletOpen] = useState(false);

  const {
    cards,
    paymentMethods,
    channels,
    datasetReady,
    datasetError,
    dataVersion,
    loadDatasets,
    locate,
    locateStatus,
    locateMessage,
    detectedDistance,
    detectedStore,
    nearbyStores,
    coords,
    coordsAccuracy,
    locatedAt,
    matchRadius,
    stores,
    manualStoreId,
    setManualStore,
    ownedCardIds,
    toggleCard,
    carriers,
    activeCarrierId,
    addCarrier,
    removeCarrier,
    updateCarrier,
    setActiveCarrier,
    activeCarrier,
    activeStore,
    activeRegion,
    packCatalog,
    packAttribution,
    installedPacks,
    packTask,
    storageUsedKb,
    autoUpdatePacks,
    premiumUnlocked,
    installPack,
    removePack,
    setAutoUpdatePacks,
    customCards,
    cardMeta,
    annualEarned,
    setCardMeta,
    addCustomCard,
    updateCustomCard,
    removeCustomCard,
    exportWallet,
    importWallet,
    usage,
    lastAmount,
    setLastAmount,
    logSpend,
    clearUsage,
    onboarded,
    completeOnboarding,
  } = useAppStore();

  const store = activeStore();
  const currentCarrier = activeCarrier();
  const region = activeRegion();

  // 頂部標頭的常駐條碼按鈕：有條碼就直接開全螢幕，沒有就導去「載具」分頁新增
  const [barcodeOpenSignal, setBarcodeOpenSignal] = useState(0);
  const handleOpenBarcode = () => {
    if (currentCarrier) {
      setBarcodeOpenSignal((n) => n + 1);
    } else {
      setTab('carrier');
    }
  };

  // GPS 判斷出目前通路後，比對使用者有沒有對應的會員卡條碼——
  // 有的話在主畫面跳出提示，點下去直接切成那張會員卡並開全螢幕，
  // 不用先自己切去載具分頁再找半天。
  // 一個通路可能對應多張候選卡（日韓的通路只有分類層級，例如「日本便利商店」
  // 對應 PONTA / nanaco / T-POINT），這裡取使用者「實際擁有的第一張」，
  // 沒有的話就不提示，不會叫使用者去辦一張他沒有的卡。
  const memberPresetLabels = CHANNEL_MEMBER_CARD_MAP[store.id] ?? [];
  const matchedMemberCarrier =
    carriers.find((c) => memberPresetLabels.includes(c.label)) ?? null;
  const [dismissedMemberHint, setDismissedMemberHint] = useState<string | null>(null);
  const handleUseMemberCard = () => {
    if (!matchedMemberCarrier) return;
    setActiveCarrier(matchedMemberCarrier.id);
    setBarcodeOpenSignal((n) => n + 1);
  };

  // 使用者按「數字不對？」→ 開啟預填好的 GitHub issue 表單
  const handleReportRule = (result: CalculatedRewardResult) => {
    const card = combinedCards.find((c) => c.id === result.cardId);
    const channel = stores.find((s) => s.id === store.id) ?? store;
    if (!card) return;
    const url = buildRuleReportUrl({
      card,
      paymentMethod: result.paymentMethod,
      channel,
      result,
      dataVersion,
    });
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  // 本月已累計的回饋金額，只算當月的紀錄
  const usedThisMonth = useMemo(() => {
    const month = currentMonth();
    return Object.values(usage)
      .filter((u) => u.month === month)
      .reduce((sum, u) => sum + u.earned, 0);
  }, [usage]);
  // 電支帳戶（always_available）會自動參與試算，不是使用者要勾的卡片
  // 規則庫的卡 + 使用者自己新增的卡
  const combinedCards = useMemo(() => [...cards, ...customCards], [cards, customCards]);
  const selectableCards = useMemo(
    () => combinedCards.filter((c) => !c.always_available),
    [combinedCards],
  );

  useEffect(() => {
    void loadDatasets();
  }, [loadDatasets]);

  // 資料就緒後自動定位一次，之後由使用者按「重新定位」控制
  const autoLocated = useRef(false);
  useEffect(() => {
    if (datasetReady && !autoLocated.current) {
      autoLocated.current = true;
      void locate();
    }
  }, [datasetReady, locate]);

  const { ranked, affiliate } = useMemo(
    () =>
      calculateRewards({
        selectedStoreId: store.id,
        region,
        userOwnedCardIds: ownedCardIds,
        allCards: combinedCards,
        paymentMethods,
        usage,
      }),
    [store.id, region, ownedCardIds, combinedCards, paymentMethods, usage],
  );

  const header = (
    <StoreDetector
      activeStore={store}
      detectedDistance={detectedDistance}
      locateStatus={locateStatus}
      locateMessage={locateMessage}
      channels={channels}
      isManual={Boolean(manualStoreId)}
      nearbyStores={nearbyStores}
      onLocate={() => void locate()}
      onSelectChannel={setManualStore}
    />
  );

  const handleTabChange = (next: TabKey) => {
    if (next === 'wallet') {
      setWalletOpen(true);
      return;
    }
    setTab(next);
  };

  if (!onboarded) {
    return <Onboarding onFinish={completeOnboarding} />;
  }

  return (
    <Layout
      header={header}
      activeTab={walletOpen ? 'wallet' : tab}
      onTabChange={handleTabChange}
      onOpenWallet={() => setWalletOpen(true)}
      ownedCount={ownedCardIds.length}
      dataVersion={dataVersion}
      hasCarrier={Boolean(currentCarrier)}
      onOpenBarcode={handleOpenBarcode}
    >
      {datasetError ? (
        <section className="block rounded-2xl p-5 text-center">
          <p className="text-[14px] font-medium">規則庫沒讀到</p>
          <p className="mt-1.5 text-[13px] text-dim">{datasetError}</p>
          <button
            type="button"
            onClick={() => void loadDatasets()}
            className="tap mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-[var(--accent)] px-5 text-[14px] font-bold text-[var(--accent-ink)]"
          >
            <RefreshCw size={16} aria-hidden />
            重新載入
          </button>
        </section>
      ) : !datasetReady ? (
        <div className="flex flex-col items-center gap-3 py-20 text-dim">
          <Loader2 size={22} className="animate-spin text-[var(--accent)]" aria-hidden />
          <p className="text-[13px]">正在載入回饋規則庫…</p>
        </div>
      ) : tab === 'packs' ? (
        /* ---------------- 地標分頁 ---------------- */
        <PackManager
          catalog={packCatalog}
          installed={installedPacks}
          attribution={packAttribution}
          task={packTask}
          storageUsedKb={storageUsedKb}
          autoUpdate={autoUpdatePacks}
          premiumUnlocked={premiumUnlocked}
          onInstall={(id) => void installPack(id)}
          onRemove={(id) => void removePack(id)}
          onToggleAutoUpdate={setAutoUpdatePacks}
          diagnostics={{
            status: locateStatus,
            coords,
            accuracy: coordsAccuracy,
            locatedAt,
            nearestName: detectedStore
              ? `${detectedStore.name}${detectedStore.branch ? ` ${detectedStore.branch}` : ''}`
              : null,
            nearestDistance: detectedDistance,
            matchRadius,
            loadedStores: stores.length,
            onLocate: () => void locate(),
          }}
        />
      ) : tab === 'carrier' ? (
        /* ---------------- 載具分頁 ---------------- */
        <div className="space-y-4">
          <BarcodeCard
            carriers={carriers}
            activeCarrier={currentCarrier}
            onSelect={setActiveCarrier}
            onAdd={addCarrier}
            onRemove={removeCarrier}
            onUpdate={updateCarrier}
          />
          <section className="block rounded-2xl p-4">
            <div className="flex items-center gap-2">
              <ScanLine size={16} className="text-[var(--accent)]" aria-hidden />
              <h2 className="text-[14px] font-semibold">結帳流程</h2>
            </div>
            <ol className="mt-2.5 space-y-2 text-[13px] leading-relaxed text-dim">
              <li>1. 先報載具，讓店員掃上面的條碼。</li>
              <li>2. 回到「刷哪張」，看第一名要用哪個支付。</li>
              <li>3. 點「開啟 App」直接跳過去付款。</li>
            </ol>
            {!isStandalone() ? (
              <p className="mt-3 rounded-xl bg-[var(--surface-2)] px-3 py-2.5 text-[12px] leading-relaxed text-dim">
                在 Safari 按下方分享鍵，選「加入主畫面」，之後開啟就是全螢幕，離線也能叫出條碼。
              </p>
            ) : null}
          </section>
        </div>
      ) : (
        /* ---------------- 推薦分頁：簡化版 ----------------
           資訊層次只有三層：頂部條碼快取 → 主要推薦 → 次要選項。
           金額輸入、記帳、辦卡導流都收到「更多」抽屜，
           使用者第一次看到不會被淹沒。 */
        <div className="stack">
          {/*
            金額換算與本月記帳：常駐展開，固定釘在最上面（緊接頂部標頭），
            不管排名結果有幾筆、有沒有海外模式提示，這裡的位置都不會跑掉——
            使用者輸入一次金額，往下捲動看排名時，每張卡的預估回饋已經算好了。
          */}
          {ownedCardIds.length > 0 && ranked.length > 0 ? (
            <section className="block rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 text-[13px] font-medium">
                <Sparkles size={14} className="text-[var(--accent)]" aria-hidden />
                金額換算與本月記帳
              </div>
              <div className="mt-2.5 space-y-3">
                <div className="flex items-center gap-3">
                  <label htmlFor="amount-input" className="shrink-0 text-[13px] text-dim">
                    這筆金額
                  </label>
                  <span className="num shrink-0 text-[15px] text-dim">NT$</span>
                  <input
                    id="amount-input"
                    value={lastAmount === 0 ? '' : String(lastAmount)}
                    onChange={(e) =>
                      setLastAmount(Number(e.target.value.replace(/[^0-9]/g, '')) || 0)
                    }
                    inputMode="numeric"
                    placeholder="300"
                    className="num block-inset min-w-0 flex-1 rounded-xl px-3 py-2 text-[16px] outline-none placeholder:text-[var(--text-faint)]"
                  />
                </div>
                {usedThisMonth > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('要清掉本月所有記帳嗎？')) clearUsage();
                    }}
                    className="tap num flex w-full items-center justify-between rounded-xl px-1 text-[12px] text-dim"
                  >
                    <span>本月已記回饋</span>
                    <span className="underline underline-offset-4">
                      NT${usedThisMonth.toLocaleString('zh-TW')}．清空
                    </span>
                  </button>
                ) : (
                  <p className="text-[11.5px] text-faint">
                    每張卡下方按「記一筆」就會累計本月已用額度，上限滿了會自動改推別張卡。
                  </p>
                )}
              </div>
            </section>
          ) : null}

          {region !== 'TW' ? (
            <section
              className="block rounded-2xl px-4 py-3"
              style={{ borderColor: 'var(--accent)' }}
            >
              <p className="mb-1 text-[12px] font-semibold text-[var(--accent)]">
                {region === 'JP' ? '🇯🇵 日本模式' : '🇰🇷 韓國模式'}
              </p>
              <p className="text-[12.5px] leading-relaxed text-dim">
                {region === 'JP'
                  ? '街口、全支付、玉山 Wallet 等掃日本 PayPay 免 1.5% 海外手續費。'
                  : '台灣 Pay／悠遊付／icash Pay 走 Paybooc、全支付走 ZeroPay、LINE Pay 指定店家。刷卡拒絕台幣結帳。'}
              </p>
            </section>
          ) : null}

          {/*
            GPS 判斷出目前通路 + 使用者有對應的會員卡條碼 → 跳出提示。
            這裡故意用 dismissedMemberHint 記住「這次已經關掉了」，避免使用者
            關掉一次之後，只要 GPS 座標稍微跳動又重新觸發同一個提示，變得煩人。
          */}
          {matchedMemberCarrier && dismissedMemberHint !== matchedMemberCarrier.id ? (
            <section className="block flex items-center gap-3 rounded-2xl px-4 py-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ background: 'var(--accent-soft)' }}
              >
                <ScanLine size={18} className="text-[var(--accent)]" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium leading-snug">
                  這裡是{store.name}，要出示「{matchedMemberCarrier.label}」嗎？
                </p>
              </div>
              <button
                type="button"
                onClick={handleUseMemberCard}
                className="tap shrink-0 rounded-full bg-[var(--accent)] px-3.5 py-2 text-[12.5px] font-semibold text-[var(--accent-ink)]"
              >
                出示
              </button>
              <button
                type="button"
                onClick={() => setDismissedMemberHint(matchedMemberCarrier.id)}
                aria-label="關閉提示"
                className="tap shrink-0 rounded-full p-1.5 text-[var(--text-faint)]"
              >
                <X size={16} aria-hidden />
              </button>
            </section>
          ) : null}

          {ownedCardIds.length === 0 ? (
            <section className="block rounded-2xl px-5 py-9 text-center">
              <CreditCard size={26} className="mx-auto text-[var(--text-faint)]" aria-hidden />
              <p className="mt-3 text-[15px] font-medium">先告訴我你有哪幾張卡</p>
              <p className="mx-auto mt-1.5 max-w-[16rem] text-[13px] leading-relaxed text-dim">
                勾好卡片之後，走到哪一間店都會直接排出該刷哪張、用哪個支付。
              </p>
              <button
                type="button"
                onClick={() => setWalletOpen(true)}
                className="tap btn-primary mt-4 inline-flex h-11 items-center gap-2 px-5 text-[14px]"
              >
                打開皮夾挑卡
              </button>
            </section>
          ) : ranked.length === 0 ? (
            <section className="block rounded-2xl px-5 py-9 text-center">
              <p className="text-[15px] font-medium">這個通路目前沒有命中的規則</p>
              <p className="mt-1.5 text-[13px] text-dim">
                換個通路看看，或到皮夾補上其他卡片。
              </p>
            </section>
          ) : (
            <>
              {/*
                全部名次一次呈現，不摺疊——維持單欄、由上到下排列。
                並列（同名次）只用「並列第 N 名」的徽章標示，不改成雙欄
                並排——並排會壓縮可用寬度，說明文字跟上限明細這種比較長的
                內容會被擠壓變小、看不清楚。每張卡不管是不是並列，都維持
                完整版面（compact=false），詳細說明跟回饋上限一律顯示。
              */}
              {groupByRank(ranked).map((group) => (
                <div key={group.rank} className="space-y-3">
                  {group.items.map((result) => (
                    <PaymentRankCard
                      key={`${result.paymentMethod.id}-${result.cardId}`}
                      result={result}
                      region={region}
                      amount={lastAmount}
                      onLogSpend={logSpend}
                      onReportRule={handleReportRule}
                      compact={false}
                    />
                  ))}
                </div>
              ))}

              {affiliate ? <AffiliatePromoCard suggestion={affiliate} storeName={store.name} /> : null}
            </>
          )}

          {/* 沒有條碼時的溫和引導，只在皮夾非空時顯示，避免新用戶被雙重引導 */}
          {ownedCardIds.length > 0 && !currentCarrier ? (
            <button
              type="button"
              onClick={() => setTab('carrier')}
              className="tap block-inset flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left"
            >
              <ScanLine size={16} className="shrink-0 text-[var(--accent)]" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium">加一組手機條碼</span>
                <span className="mt-0.5 block text-[12px] text-dim">
                  結帳時直接叫出來，一次設定就好
                </span>
              </span>
            </button>
          ) : null}

          {store.id === 'general' && locateStatus === 'success' && installedPacks.length === 0 && ranked.length > 0 ? (
            <button
              type="button"
              onClick={() => setTab('packs')}
              className="tap block-inset flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left"
            >
              <MapPin size={16} className="shrink-0 text-[var(--accent)]" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium">下載你所在地區的地標</span>
                <span className="mt-0.5 block text-[12px] text-dim">
                  走進店裡就會自動判斷是哪一家
                </span>
              </span>
            </button>
          ) : null}
        </div>
      )}

      {/*
        無頭條碼實例：常駐掛載，不管目前在哪個分頁，頂部標頭的條碼按鈕
        觸發 barcodeOpenSignal 時都能叫出全螢幕。平常不渲染任何看得到
        的東西，跟下面 CardSelectorModal 用 open prop 控制顯示是同一種模式。
      */}
      <BarcodeCard
        headless
        openSignal={barcodeOpenSignal}
        carriers={carriers}
        activeCarrier={currentCarrier}
        onSelect={setActiveCarrier}
        onAdd={addCarrier}
        onRemove={removeCarrier}
        onUpdate={updateCarrier}
      />

      <CardSelectorModal
        open={walletOpen}
        cards={selectableCards}
        ownedCardIds={ownedCardIds}
        carriers={carriers}
        activeCarrierId={activeCarrierId}
        onToggleCard={toggleCard}
        onAddCarrier={addCarrier}
        onRemoveCarrier={removeCarrier}
        onSelectCarrier={setActiveCarrier}
        paymentMethods={paymentMethods}
        channels={channels}
        onAddCustomCard={addCustomCard}
        onUpdateCustomCard={updateCustomCard}
        onRemoveCustomCard={removeCustomCard}
        cardMeta={cardMeta}
        annualEarned={annualEarned}
        onSetCardMeta={setCardMeta}
        onExportWallet={exportWallet}
        onImportWallet={importWallet}
        onClose={() => setWalletOpen(false)}
      />
    </Layout>
  );
}
