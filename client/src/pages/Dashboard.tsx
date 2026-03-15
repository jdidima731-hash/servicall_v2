import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { PhoneIcon, UserGroupIcon, ClockIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { api } from '../services/api';

const stats = [
  { name: 'Appels aujourd\'hui', value: '12', icon: PhoneIcon, change: '+2', changeType: 'increase' },
  { name: 'Durée totale', value: '3h 24m', icon: ClockIcon, change: '+12%', changeType: 'increase' },
  { name: 'Clients contactés', value: '8', icon: UserGroupIcon, change: '-1', changeType: 'decrease' },
  { name: 'Taux de réponse', value: '94%', icon: ChartBarIcon, change: '+4%', changeType: 'increase' },
];

export default function Dashboard() {
  const { data: recentCalls, isLoading } = useQuery({
    queryKey: ['recentCalls'],
    queryFn: () => api.get('/calls?limit=5').then(res => res.data),
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
      
      {/* Stats */}
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <stat.icon className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">{stat.name}</dt>
                    <dd>
                      <div className="text-lg font-medium text-gray-900">{stat.value}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-5 py-3">
              <div className="text-sm">
                <span className={`font-medium ${stat.changeType === 'increase' ? 'text-green-600' : 'text-red-600'}`}>
                  {stat.change}
                </span>
                <span className="text-gray-500"> vs hier</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent calls */}
      <div className="mt-8">
        <h2 className="text-lg font-medium text-gray-900">Appels récents</h2>
        <div className="mt-4 bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {isLoading ? (
              <li className="px-6 py-4 text-center text-gray-500">Chargement...</li>
            ) : recentCalls?.length === 0 ? (
              <li className="px-6 py-4 text-center text-gray-500">Aucun appel récent</li>
            ) : (
              recentCalls?.map((call: any) => (
                <li key={call.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <PhoneIcon className="h-5 w-5 text-gray-400" />
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">{call.callerId}</p>
                        <p className="text-sm text-gray-500">vers {call.recipientId}</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        call.status === 'completed' ? 'bg-green-100 text-green-800' :
                        call.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {call.status === 'completed' ? 'Terminé' :
                         call.status === 'in-progress' ? 'En cours' : 'En attente'}
                      </span>
                      <span className="ml-3 text-sm text-gray-500">
                        {new Date(call.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
