export interface LegalUpdate {
  id?: number;
  source_url: string;
  title: string;
  summary: string;
  topic: string;
  impact_level: 'High' | 'Medium' | 'Low';
  compliance_actions: string;
  departments: string;
  status: 'pending' | 'reviewed' | 'actioned';
  timestamp?: string;
}

export interface ScrapedData {
  title: string;
  text: string;
  url: string;
}

export interface AgentStats {
  total: number;
  highImpact: number;
  pending: number;
}
