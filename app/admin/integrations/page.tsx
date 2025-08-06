'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RefreshCw, Plus, Settings, Key, Webhook, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react'

export default function IntegrationsPage() {
  const [apiKeys, setApiKeys] = useState([
    {
      id: '1',
      name: 'Shopify Integration',
      key: 'sk_live_***************',
      status: 'active',
      lastUsed: '2024-01-15T10:30:00Z',
      permissions: ['read:orders', 'write:fulfillments']
    },
    {
      id: '2',
      name: 'Mobile App API',
      key: 'app_***************',
      status: 'active',
      lastUsed: '2024-01-15T09:15:00Z',
      permissions: ['read:orders', 'write:orders', 'read:drivers']
    }
  ])

  const [webhooks, setWebhooks] = useState([
    {
      id: '1',
      url: 'https://api.example.com/webhooks/orders',
      events: ['order.created', 'order.updated', 'order.delivered'],
      status: 'active',
      lastTriggered: '2024-01-15T10:30:00Z'
    }
  ])

  const integrations = [
    {
      name: 'Shopify',
      description: 'Sync orders from your Shopify store',
      status: 'connected',
      icon: '🛍️',
      lastSync: '2024-01-15T10:30:00Z'
    },
    {
      name: 'WooCommerce',
      description: 'Import orders from WooCommerce',
      status: 'available',
      icon: '🛒',
      lastSync: null
    },
    {
      name: 'Magento',
      description: 'Connect with Magento stores',
      status: 'available',
      icon: '🏪',
      lastSync: null
    },
    {
      name: 'BigCommerce',
      description: 'Integrate with BigCommerce',
      status: 'available',
      icon: '🏬',
      lastSync: null
    }
  ]

  const getStatusColor = (status: string) => {
    const colors = {
      active: 'bg-green-500/10 text-green-400 border-green-500/20',
      connected: 'bg-green-500/10 text-green-400 border-green-500/20',
      inactive: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
      available: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      error: 'bg-red-500/10 text-red-400 border-red-500/20',
    }
    return colors[status as keyof typeof colors] || colors.inactive
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Integrations</h1>
          <p className="text-slate-400">Manage API keys, webhooks, and third-party integrations</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Add Integration
        </Button>
      </div>

      <Tabs defaultValue="integrations" className="space-y-6">
        <TabsList className="bg-slate-800 border-slate-700">
          <TabsTrigger value="integrations" className="data-[state=active]:bg-slate-700">
            Integrations
          </TabsTrigger>
          <TabsTrigger value="api-keys" className="data-[state=active]:bg-slate-700">
            API Keys
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="data-[state=active]:bg-slate-700">
            Webhooks
          </TabsTrigger>
        </TabsList>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {integrations.map((integration) => (
              <Card key={integration.name} className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">{integration.icon}</div>
                      <div>
                        <CardTitle className="text-white text-lg">{integration.name}</CardTitle>
                        <CardDescription className="text-slate-400">
                          {integration.description}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge className={getStatusColor(integration.status)}>
                      {integration.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {integration.lastSync && (
                    <div className="text-sm text-slate-400">
                      Last sync: {new Date(integration.lastSync).toLocaleString()}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    {integration.status === 'connected' ? (
                      <>
                        <Button variant="outline" size="sm" className="flex-1 bg-slate-800 border-slate-700">
                          <Settings className="h-4 w-4 mr-2" />
                          Configure
                        </Button>
                        <Button variant="outline" size="sm" className="bg-slate-800 border-slate-700">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700">
                        Connect
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="api-keys" className="space-y-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-white">API Keys</CardTitle>
                <CardDescription className="text-slate-400">
                  Manage API keys for external integrations
                </CardDescription>
              </div>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Generate Key
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {apiKeys.map((apiKey) => (
                <div key={apiKey.id} className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <Key className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="font-medium text-white">{apiKey.name}</p>
                      <p className="text-sm text-slate-400 font-mono">{apiKey.key}</p>
                      <div className="flex items-center space-x-4 mt-1">
                        <span className="text-xs text-slate-500">
                          Last used: {new Date(apiKey.lastUsed).toLocaleString()}
                        </span>
                        <div className="flex items-center space-x-1">
                          {apiKey.permissions.map((permission) => (
                            <Badge key={permission} variant="outline" className="text-xs">
                              {permission}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(apiKey.status)}>
                      {apiKey.status}
                    </Badge>
                    <Button variant="ghost" size="sm" className="text-slate-400">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Webhooks Tab */}
        <TabsContent value="webhooks" className="space-y-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-white">Webhooks</CardTitle>
                <CardDescription className="text-slate-400">
                  Configure webhook endpoints for real-time notifications
                </CardDescription>
              </div>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Add Webhook
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {webhooks.map((webhook) => (
                <div key={webhook.id} className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <Webhook className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="font-medium text-white flex items-center gap-2">
                        {webhook.url}
                        <ExternalLink className="h-3 w-3" />
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs text-slate-500">Events:</span>
                        {webhook.events.map((event) => (
                          <Badge key={event} variant="outline" className="text-xs">
                            {event}
                          </Badge>
                        ))}
                      </div>
                      <span className="text-xs text-slate-500">
                        Last triggered: {new Date(webhook.lastTriggered).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(webhook.status)}>
                      {webhook.status}
                    </Badge>
                    <Button variant="ghost" size="sm" className="text-slate-400">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Add Webhook Form */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Add New Webhook</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="webhook-url" className="text-slate-300">Webhook URL</Label>
                    <Input
                      id="webhook-url"
                      placeholder="https://your-app.com/webhooks/delivery"
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Events</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {['order.created', 'order.updated', 'order.delivered', 'order.failed'].map((event) => (
                        <label key={event} className="flex items-center space-x-2">
                          <input type="checkbox" className="rounded" />
                          <span className="text-sm text-slate-300">{event}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <Button className="w-full bg-blue-600 hover:bg-blue-700">
                    Create Webhook
                  </Button>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
