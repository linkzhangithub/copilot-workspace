import { config } from 'dotenv';
import fs from 'fs';
import express from "express";
import cors from "cors";
import AIService from "./services/aiService.js";

const envPath = './.env';
if (fs.existsSync(envPath)) {
  const result = config({ path: envPath });
  if (result.error) {
    console.error('加载 .env 文件失败:', result.error);
  } else {
    console.log('.env 文件加载成功');
    console.log('ZHIPU_API_KEY:', process.env.ZHIPU_API_KEY ? '已设置' : '未设置');
  }
} else {
  console.warn('.env 文件不存在');
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let aiService = null;
try {
  aiService = new AIService();
  console.log('AIService 初始化成功');
} catch (error) {
  console.error('AIService 初始化失败:', error.message);
  process.exit(1);
}

app.post('/api/ai/generate-outline', async (req, res) => {
  console.log('收到请求:', req.body);
  try {
    const { topic } = req.body;
    
    if (!topic || typeof topic !== 'string') {
      return res.status(400).json({ success: false, error: '请提供有效的文章主题' });
    }

    console.log('正在生成大纲，主题:', topic);
    const outline = await aiService.generateOutline(topic);
    console.log('大纲生成成功:', outline.length, '个章节');
    
    res.json({ success: true, data: outline });
  } catch (error) {
    console.error('生成大纲失败:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/ai/generate-content', async (req, res) => {
  try {
    const { outline, sectionIndex } = req.body;
    
    if (!outline || !Array.isArray(outline)) {
      return res.status(400).json({ success: false, error: '请提供有效的文章大纲' });
    }

    if (typeof sectionIndex !== 'number' || sectionIndex < 0) {
      return res.status(400).json({ success: false, error: '请提供有效的段落索引' });
    }

    const response = await aiService.generateContent(outline, sectionIndex);
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    response.data.on('data', (chunk) => {
      const chunkStr = chunk.toString('utf8');
      const lines = chunkStr.split('\n').filter(line => line.trim());
      
      lines.forEach(line => {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            res.write('data: [DONE]\n\n');
            res.end();
          } else {
            try {
              const json = JSON.parse(data);
              const content = json.choices[0]?.delta?.content || '';
              if (content) {
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      });
    });

    response.data.on('end', () => {
      res.end();
    });

    response.data.on('error', (error) => {
      console.error('流式响应错误:', error);
      res.end();
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 非流式简化版本
app.post('/api/ai/generate-content-simple', async (req, res) => {
  try {
    const { outline, sectionIndex } = req.body;
    
    if (!outline || !Array.isArray(outline)) {
      return res.status(400).json({ success: false, error: '请提供有效的文章大纲' });
    }

    if (typeof sectionIndex !== 'number' || sectionIndex < 0) {
      return res.status(400).json({ success: false, error: '请提供有效的段落索引' });
    }

    console.log('正在生成内容，第', sectionIndex + 1, '节');
    
    // 使用非流式的 generateContent，我们需要修改 aiService
    // 这里创建一个临时的非流式版本
    const currentSection = outline[sectionIndex];
    const context = outline
      .slice(0, sectionIndex)
      .map((s) => s.title)
      .join(' → ');

    const messages = [
      {
        role: 'system',
        content: '你是一个专业的文案撰写助手，擅长根据大纲撰写详细的文章内容。\n\n⚠️ 严格遵守以下规则：\n1. 只返回正文内容，绝对不要添加任何标题\n2. 不要以#、##、###等markdown标题开头\n3. 不要重复当前章节的标题\n4. 不要添加任何解释、说明或引导文字\n5. 直接开始撰写正文的第一句话\n6. 输出格式应该就是纯文本段落，不要任何markdown格式',
      },
      {
        role: 'user',
        content: `根据以下文章大纲和上下文，撰写第${sectionIndex + 1}部分的正文内容：\n\n文章主题上下文：${context || '无'}\n\n当前章节：${currentSection.title}\n子主题：${currentSection.children?.join('、') || '无'}\n\n请撰写一段详细的正文内容，字数约300-500字。\n\n⚠️ 再次提醒：只返回纯文本正文，不要任何标题！`,
      },
    ];

    // 使用非流式请求
    const response = await aiService.client.chatCompletions({
      model: aiService.model,
      messages,
      temperature: 0.8,
      max_tokens: 1000,
      stream: false,
    });

    const message = response.data.choices[0]?.message;
    const content = message?.content || message?.reasoning_content || '';

    console.log('内容生成成功');
    res.json({ success: true, data: content });
  } catch (error) {
    console.error('生成内容失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/ai/rewrite', async (req, res) => {
  try {
    const { content, operation } = req.body;
    
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ success: false, error: '请提供有效的内容' });
    }

    const validOperations = ['polish', 'expand', 'shorten'];
    if (!operation || !validOperations.includes(operation)) {
      return res.status(400).json({ success: false, error: '请提供有效的操作类型（polish/expand/shorten）' });
    }

    const result = await aiService.rewriteContent(content, operation);
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
