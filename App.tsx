
import React, { useState, useEffect, useCallback } from 'react';
import { parseRawSSE, reconstructMessage } from './services/sseParser';
import { SSEEvent, MessageState, ClaudeChatHistory } from './types';
import EventItem from './components/EventItem';
import MessagePreview from './components/MessagePreview';
import ChatHistory from './components/ChatHistory';

const EXAMPLE_SSE = `HTTP/1.1 200 OK
Date: Thu, 22 Jan 2026 07:47:40 GMT
Content-Type: text/event-stream

event: message_start
data: {"type":"message_start","message":{"model":"claude-haiku-4-5-20251001","id":"msg_018cm4M9aUKGUBQVjTopFThQ","type":"message","role":"assistant","content":[],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":9,"cache_creation_input_tokens":5646,"cache_read_input_tokens":13370,"output_tokens":1}} }

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":"","signature":""} }

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"用"} }

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"户"} }

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"请求"} }

event: content_block_stop
data: {"type":"content_block_stop","index":0 }

event: message_stop
data: {"type":"message_stop"}
`;

const EXAMPLE_HTTP = `{
    "model": "claude-haiku-4-5-20251001",
    "messages": [
        {
            "role": "user",
            "content": [
                { "type": "text", "text": "@src/Hello.java 有错误，告诉我原因，我应该怎么修复" }
            ]
        },
        {
            "role": "assistant",
            "content": [
                {
                    "type": "thinking",
                    "thinking": "用户要求我检查 \`/src/Hello.java\` 文件中的错误。我需要读取这个文件。",
                    "signature": "EtQCCkYICxgCKkBd7b7bG3Dstd88+eyZgO9gCMl3FJwOmhEKbg6QvMGXKm+CzZaR+KjZJGTJ3qkGk0mvV6YCFL8MKrF+T4CaycpOEgyezDUI1T"
                },
                {
                    "type": "tool_use",
                    "id": "toolu_01X2snB1Lu3u4464Q3Zf8cqe",
                    "name": "Read",
                    "input": { "file_path": "/Users/tommy/temp/myProject/src/Hello.java" }
                }
            ]
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "tool_result",
                    "content": "<tool_use_error>File does not exist.</tool_use_error>",
                    "is_error": true,
                    "tool_use_id": "toolu_01X2snB1Lu3u4464Q3Zf8cqe"
                }
            ]
        }
    ]
}`;

const App: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [viewMode, setViewMode] = useState<'sse' | 'dialogue'>('sse');
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [messageState, setMessageState] = useState<MessageState>({ blocks: [] });
  const [chatHistory, setChatHistory] = useState<ClaudeChatHistory | null>(null);

  const handleParse = useCallback(() => {
    if (!inputText.trim()) {
      setEvents([]);
      setMessageState({ blocks: [] });
      setChatHistory(null);
      return;
    }

    try {
      // Check if it's a direct JSON dialogue history
      const json = JSON.parse(inputText);
      if (json.messages && Array.isArray(json.messages)) {
        setViewMode('dialogue');
        setChatHistory(json);
        return;
      }
    } catch (e) {
      // Not a pure dialogue JSON, try SSE parsing
    }

    // Default to SSE
    setViewMode('sse');
    const parsed = parseRawSSE(inputText);
    setEvents(parsed);
    const reconstructed = reconstructMessage(parsed);
    setMessageState(reconstructed);
  }, [inputText]);

  useEffect(() => {
    handleParse();
  }, [handleParse]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Claude 协议检查器</h1>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">AI 对话分析教学工具</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setInputText(EXAMPLE_SSE)}
            className="px-4 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-100"
          >
            加载 SSE 示例
          </button>
          <button 
            onClick={() => setInputText(EXAMPLE_HTTP)}
            className="px-4 py-2 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-emerald-100"
          >
            加载对话示例
          </button>
          <button 
            onClick={() => { setInputText(''); setEvents([]); setChatHistory(null); }}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors border border-slate-200"
          >
            清空
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Input Pane */}
        <div className="w-full md:w-1/3 flex flex-col border-r border-slate-200 h-[calc(100vh-73px)]">
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex justify-between items-center">
              <span>原始数据输入</span>
              <span className={`px-2 py-0.5 rounded ${viewMode === 'sse' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                检测到: {viewMode.toUpperCase()}
              </span>
            </div>
            <textarea 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="粘贴 SSE 文本流或 Claude 对话 JSON..." 
              className="w-full h-48 p-4 bg-white border border-slate-200 rounded-xl shadow-inner focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-[10px] mono resize-none"
            />
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            {viewMode === 'sse' ? (
              <>
                <div className="px-4 py-3 bg-white border-b border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">事件序列 ({events.length})</span>
                </div>
                <div className="flex-1 overflow-y-auto bg-white">
                  {events.map((ev) => <EventItem key={ev.id} event={ev} />)}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col bg-slate-100 p-8 items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-200 flex items-center justify-center text-emerald-600">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <h3 className="font-bold text-slate-700">对话模式已激活</h3>
                <p className="text-xs text-slate-500 leading-relaxed">检测到直接对话历史记录。<br/>在右侧可视化完整的对话序列。</p>
              </div>
            )}
          </div>
        </div>

        {/* View Pane */}
        <div className="w-full md:w-2/3 flex flex-col h-[calc(100vh-73px)] bg-slate-50">
          <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm z-[5]">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">可视化重建</span>
          </div>
          <div className="flex-1 overflow-y-auto p-8 scroll-smooth">
            {viewMode === 'sse' ? (
              <MessagePreview state={messageState} />
            ) : chatHistory ? (
              <ChatHistory history={chatHistory} />
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
