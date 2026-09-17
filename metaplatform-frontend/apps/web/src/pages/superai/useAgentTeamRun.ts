import { useCallback, useEffect, useRef, useState } from 'react';
import { getRun, streamRunEvents, type RunState } from '@/api/agentTeam';

/**
 * 驱动**一轮 agent-team run**：`GET /runs/{id}` 给"现在长什么样"，步骤级事件流
 * 负责说"有推进了"。工作台与会话页共用这一个 hook，所以两个页面对同一轮运行的
 * 行为一致（同一个实时语义、同一套合并拉取）。
 *
 * **没有轮询定时器**：停了流就不再请求。
 */
export function useAgentTeamRun(runId: string) {
  const [run, setRun] = useState<RunState | null>(null);
  /** 事件流连着没有——UI 上要说实话，别让人以为"不动"就是"没在跑"。 */
  const [live, setLive] = useState(false);

  const refresh = useRefresh(runId, setRun);

  // 换了 run 先取一次：受理制下 `POST /runs` 只回 202，图上还没有任何步骤，
  // 光等事件流会让界面停在"已受理"的空态上。
  useEffect(() => {
    if (!runId) return;
    void refresh();
  }, [runId, refresh]);

  // 订阅步骤级事件流：回放 + 尾随，run 落终态时服务端发 end 收流。
  // 停在闸门的 run **不会**自己收流——人工确认之后的推进仍从同一条流到达。
  useEffect(() => {
    if (!runId) {
      setLive(false);
      return;
    }
    setLive(false);
    const stop = streamRunEvents(runId, {
      onOpen: () => setLive(true),
      onStep: () => void refresh(),
      onEnd: () => {
        setLive(false);
        void refresh();
      },
      onError: () => setLive(false),
    });
    return () => {
      stop();
      setLive(false);
    };
  }, [runId, refresh]);

  return { run, setRun, live, refresh };
}

/**
 * 拉一次 run 状态。事件流每一步都会来敲一次；把密集的敲门**合并**成一次拉取
 * （前一次还没回来就只记个待办），既不丢推送也不打出一串并发请求。
 */
function useRefresh(runId: string, setRun: (run: RunState) => void) {
  const pullingRef = useRef(false);
  const pendingRef = useRef(false);
  const idRef = useRef(runId);
  idRef.current = runId;

  return useCallback(async () => {
    const id = idRef.current;
    if (!id) return;
    if (pullingRef.current) {
      pendingRef.current = true;
      return;
    }
    pullingRef.current = true;
    try {
      do {
        pendingRef.current = false;
        try {
          setRun(await getRun(id));
        } catch {
          // 读失败不该打断这条流：下一次推送会再来敲
        }
      } while (pendingRef.current);
    } finally {
      pullingRef.current = false;
    }
  }, [setRun]);
}
