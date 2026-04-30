/**
 * Zhipu API 客户端封装
 * 兼容 OpenAI 格式的接口调用
 */

import axios from 'axios';

class ZhipuClient {
  constructor() {
    this.apiKey = process.env.ZHIPU_API_KEY;
    this.baseURL = 'https://open.bigmodel.cn/api/paas/v4';
    
    if (!this.apiKey) {
      throw new Error('ZHIPU_API_KEY 环境变量未设置');
    }
  }

  /**
   * 调用 Zhipu API
   * @param {string} endpoint - API 端点
   * @param {object} data - 请求数据
   * @param {boolean} stream - 是否流式响应
   * @returns {Promise} 响应数据
   */
  async request(endpoint, data, stream = false) {
    const url = `${this.baseURL}${endpoint}`;
    
    try {
      const response = await axios({
        method: 'post',
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        data,
        responseType: stream ? 'stream' : 'json'
      });
      
      return response;
    } catch (error) {
      console.error('Zhipu API 请求失败:', error.message);
      throw error;
    }
  }

  /**
   * 兼容 OpenAI 格式的 chat completions 接口
   * @param {object} params - 请求参数
   * @returns {Promise} 响应数据
   */
  async chatCompletions(params) {
    // Zhipu API 兼容 OpenAI 格式，直接传递参数
    return this.request('/chat/completions', params, params.stream);
  }
}

export default ZhipuClient;
