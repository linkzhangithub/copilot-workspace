/**
 * AI Prompt 统一管理
 * 采用工厂函数模式，支持动态参数注入
 */

export const getOutlinePrompt = (topic) => `
你是一位专业的写作导师，擅长构建逻辑严密、层次分明的文章大纲。
请为以下主题生成一个结构清晰的大纲：${topic}

要求：
1. 包含 4-6 个主要章节
2. 每个章节下包含 2-3 个小节
3. 返回纯 JSON 格式，不要包含 Markdown 代码块标记
4. 格式示例：[{"title": "第一章", "children": ["小节1", "小节2"]}]
`;

export const getContentPrompt = (topic, title, context) => `
你是一位资深内容创作者。请根据以下信息撰写文章内容：
主题：${topic}
章节标题：${title}
上下文参考：${context || "无"}

要求：
1. 内容充实、逻辑连贯，字数在 300-500 字左右
2. 使用 Markdown 格式，但不要包含标题（因为标题已单独提供）
3. 语言风格专业且通俗易懂
`;

export const getPolishPrompt = (content) => `
请对以下内容进行润色优化：
${content}

要求：
1. 修正语病和错别字
2. 优化句子结构，使其更流畅自然
3. 提升用词的专业性和准确性
4. 保持原意不变，仅做表达上的优化
`;

export const getExpandPrompt = (content) => `
请对以下内容进行扩写丰富：
${content}

要求：
1. 增加具体的案例、数据或细节描述
2. 深入阐述核心观点
3. 使内容更加充实饱满，字数增加 50% 左右
`;

export const getShortenPrompt = (content) => `
请对以下内容进行缩写精简：
${content}

要求：
1. 保留核心观点和关键信息
2. 删除冗余修饰和重复表述
3. 使语言更加简练有力，字数减少 30% 左右
`;

export const getQualityCheckPrompt = (topic, content) => `
你是一位严格的写作质检专家。请对以下文章进行全面的质量检测：
主题：${topic}
内容：${content}

请从以下五个维度进行评价（每个维度满分 20 分）：
1. 大纲结构 (structure)
2. 章节内容 (content)
3. 逻辑严密性 (logic)
4. 内容质量 (quality)
5. 表达清晰度 (clarity)

最后给出 3 条具体的改进建议。
返回纯 JSON 格式，包含 scores, evaluations 和 suggestions 字段。
`;
