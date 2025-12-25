import axios from 'axios';
import type { AxiosError, AxiosInstance } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle errors
    this.api.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        // 401 오류는 로그인 페이지로 리다이렉트 (로그인 요청 제외)
        if (error.response?.status === 401 && !error.config?.url?.includes('/login')) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
        
        // 에러 응답이 있으면 그대로 전달
        if (error.response) {
          return Promise.reject(error);
        }
        
        // 네트워크 오류 등
        return Promise.reject(new Error('네트워크 오류가 발생했습니다. 서버가 실행 중인지 확인해주세요.'));
      }
    );
  }

  // Auth
  async login(email: string, password: string) {
    const response = await this.api.post('/users/login', { email, password });
    return response.data;
  }

  async register(username: string, email: string, password: string) {
    const response = await this.api.post('/users/register', { username, email, password });
    return response.data;
  }

  async logout() {
    const response = await this.api.post('/users/logout');
    return response.data;
  }

  async getProfile() {
    const response = await this.api.get('/users/me');
    return response.data;
  }

  // Devices
  async getDevices(params?: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    search?: string;
  }) {
    const response = await this.api.get('/devices', { params });
    return response.data;
  }

  async getDeviceById(id: number) {
    const response = await this.api.get(`/devices/${id}`);
    return response.data;
  }

  async createDevice(data: any) {
    const response = await this.api.post('/devices', data);
    return response.data;
  }

  async updateDevice(id: number, data: any) {
    const response = await this.api.put(`/devices/${id}`, data);
    return response.data;
  }

  async deleteDevice(id: number) {
    const response = await this.api.delete(`/devices/${id}`);
    return response.data;
  }

  async getDeviceSummary() {
    const response = await this.api.get('/devices/summary');
    return response.data;
  }

  async testConnection(id: number) {
    const response = await this.api.post(`/devices/${id}/test-connection`);
    return response.data;
  }

  async discoverInterfaces(id: number) {
    const response = await this.api.post(`/devices/${id}/discover-interfaces`);
    return response.data;
  }

  async getDeviceInterfaces(id: number, params?: { status?: string }) {
    const response = await this.api.get(`/devices/${id}/interfaces`, { params });
    return response.data;
  }

  async toggleDevice(id: number) {
    const response = await this.api.patch(`/devices/${id}/toggle`);
    return response.data;
  }

  async pollDevice(id: number) {
    const response = await this.api.post(`/devices/${id}/poll`);
    return response.data;
  }

  // Metrics
  async getDashboardSummary() {
    const response = await this.api.get('/metrics/dashboard');
    return response.data;
  }

  async getDeviceMetrics(
    deviceId: number,
    params?: {
      period?: string;
      interval?: string;
      metrics?: string;
      from?: string;
      to?: string;
    }
  ) {
    const response = await this.api.get(`/metrics/devices/${deviceId}`, { params });
    return response.data;
  }

  async getLatestMetrics(deviceId: number) {
    const response = await this.api.get(`/metrics/devices/${deviceId}/latest`);
    return response.data;
  }

  async getMetricStatistics(deviceId: number, period: string = '7d') {
    const response = await this.api.get(`/metrics/devices/${deviceId}/statistics`, {
      params: { period },
    });
    return response.data;
  }

  async getInterfaceMetrics(interfaceId: number, params?: { period?: string; interval?: string }) {
    const response = await this.api.get(`/metrics/interfaces/${interfaceId}`, { params });
    return response.data;
  }

  // Alarms
  async getAlarms(params?: {
    page?: number;
    limit?: number;
    status?: string;
    severity?: string;
    deviceId?: number;
    metricType?: string;
  }) {
    const response = await this.api.get('/alarms', { params });
    return response.data;
  }

  async getAlarmById(id: number) {
    const response = await this.api.get(`/alarms/${id}`);
    return response.data;
  }

  async getAlarmSummary() {
    const response = await this.api.get('/alarms/summary');
    return response.data;
  }

  async acknowledgeAlarm(id: number, note?: string) {
    const response = await this.api.patch(`/alarms/${id}/acknowledge`, { note });
    return response.data;
  }

  async resolveAlarm(id: number, note?: string) {
    const response = await this.api.patch(`/alarms/${id}/resolve`, { note });
    return response.data;
  }

  async bulkAcknowledgeAlarms(alarmIds: number[], note?: string) {
    const response = await this.api.patch('/alarms/bulk-acknowledge', { alarmIds, note });
    return response.data;
  }

  async bulkResolveAlarms(alarmIds: number[], note?: string) {
    const response = await this.api.patch('/alarms/bulk-resolve', { alarmIds, note });
    return response.data;
  }

  // Alarm Rules
  async getAlarmRules(params?: { page?: number; limit?: number; isEnabled?: boolean }) {
    const response = await this.api.get('/alarms/rules', { params });
    return response.data;
  }

  async getAlarmRuleById(id: number) {
    const response = await this.api.get(`/alarms/rules/${id}`);
    return response.data;
  }

  async createAlarmRule(data: any) {
    const response = await this.api.post('/alarms/rules', data);
    return response.data;
  }

  async updateAlarmRule(id: number, data: any) {
    const response = await this.api.put(`/alarms/rules/${id}`, data);
    return response.data;
  }

  async deleteAlarmRule(id: number) {
    const response = await this.api.delete(`/alarms/rules/${id}`);
    return response.data;
  }

  async toggleAlarmRule(id: number) {
    const response = await this.api.patch(`/alarms/rules/${id}/toggle`);
    return response.data;
  }

  // AI Analysis
  async getAnalysisStatistics(period: string = '7d') {
    const response = await this.api.get('/ai/statistics', { params: { period } });
    return response.data;
  }

  async getAnalysisHistory(params?: {
    page?: number;
    limit?: number;
    deviceId?: number;
    type?: string;
  }) {
    const response = await this.api.get('/ai/history', { params });
    return response.data;
  }

  async getAnalysisById(id: number) {
    const response = await this.api.get(`/ai/history/${id}`);
    return response.data;
  }

  async analyzeDevice(deviceId: number, forceRefresh?: boolean) {
    const response = await this.api.post(`/ai/devices/${deviceId}/analyze`, { forceRefresh });
    return response.data;
  }

  async predictDevice(deviceId: number) {
    const response = await this.api.post(`/ai/devices/${deviceId}/predict`);
    return response.data;
  }

  async analyzeAlarm(alarmId: number) {
    const response = await this.api.post(`/ai/alarms/${alarmId}/analyze`);
    return response.data;
  }

  async generateDailyReport() {
    const response = await this.api.post('/ai/reports/daily');
    return response.data;
  }

  async generateWeeklyReport() {
    const response = await this.api.post('/ai/reports/weekly');
    return response.data;
  }

  // Users (Admin only)
  async getUsers(params?: {
    page?: number;
    limit?: number;
    role?: string;
    isActive?: boolean;
    search?: string;
  }) {
    const response = await this.api.get('/users', { params });
    return response.data;
  }

  async getUserById(id: number) {
    const response = await this.api.get(`/users/${id}`);
    return response.data;
  }

  async createUser(data: any) {
    const response = await this.api.post('/users', data);
    return response.data;
  }

  async updateUser(id: number, data: any) {
    const response = await this.api.put(`/users/${id}`, data);
    return response.data;
  }

  async deleteUser(id: number) {
    const response = await this.api.delete(`/users/${id}`);
    return response.data;
  }
}

export const apiService = new ApiService();
export default apiService;

