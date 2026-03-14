import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Brain, Zap, MessageCircle, TrendingUp, AlertCircle } from 'lucide-react';

const data = [
  { name: 'Lun', calls: 45, score: 82 },
  { name: 'Mar', calls: 52, score: 78 },
  { name: 'Mer', calls: 48, score: 85 },
  { name: 'Jeu', calls: 61, score: 80 },
  { name: 'Ven', calls: 55, score: 88 },
];

const sentimentData = [
  { name: 'Positif', value: 65, color: '#10b981' },
  { name: 'Neutre', value: 25, color: '#6b7280' },
  { name: 'Négatif', value: 10, color: '#ef4444' },
];

export const IAMonitoringDashboard: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto space-y-8 p-4 md:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          Monitoring IA & Performance
        </h1>
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          Système Opérationnel
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-md transition-shadow border-none bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Appels IA Totaux</p>
                <p className="text-3xl font-bold tracking-tight">1,284</p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-xl">
                <MessageCircle className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs font-medium text-green-600 bg-green-50 w-fit px-2 py-1 rounded-full">
              <TrendingUp className="h-3 w-3 mr-1" />
              <span>+12% vs semaine dernière</span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow border-none bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Score Qualité Moyen</p>
                <p className="text-3xl font-bold tracking-tight">82.4%</p>
              </div>
              <div className="p-3 bg-yellow-500/10 rounded-xl">
                <Zap className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs font-medium text-green-600 bg-green-50 w-fit px-2 py-1 rounded-full">
              <TrendingUp className="h-3 w-3 mr-1" />
              <span>+3.2% d'amélioration</span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow border-none bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Taux de Conversion</p>
                <p className="text-3xl font-bold tracking-tight">18.5%</p>
              </div>
              <div className="p-3 bg-green-500/10 rounded-xl">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs font-medium text-green-600 bg-green-50 w-fit px-2 py-1 rounded-full">
              <TrendingUp className="h-3 w-3 mr-1" />
              <span>+1.5% ce mois</span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow border-none bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Alertes Critiques</p>
                <p className="text-3xl font-bold tracking-tight">3</p>
              </div>
              <div className="p-3 bg-red-500/10 rounded-xl">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs font-medium text-red-600 bg-red-50 w-fit px-2 py-1 rounded-full">
              <span>Nécessite attention immédiate</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Volume d'Appels & Score de Qualité</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                <Tooltip />
                <Bar yAxisId="left" dataKey="calls" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Appels" />
                <Bar yAxisId="right" dataKey="score" fill="#10b981" radius={[4, 4, 0, 0]} name="Score %" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Répartition du Sentiment</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height="80%">
              <PieChart>
                <Pie
                  data={sentimentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {sentimentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-4">
              {sentimentData.map((item) => (
                <div key={item.name} className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-muted-foreground">{item.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
