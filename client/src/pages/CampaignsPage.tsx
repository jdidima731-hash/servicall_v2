import React, { useState, useEffect } from "react";
import { Card, Button, Table, Modal, Form, Select, Input, Space, Tag, Statistic, Row, Col, Progress, message, Upload } from "antd";
import { PlayCircleOutlined, StopOutlined, DeleteOutlined, PlusOutlined, EyeOutlined, UploadOutlined } from "@ant-design/icons";
import axios from "axios";

interface Campaign {
  id: number;
  name: string;
  description: string;
  status: "draft" | "active" | "paused" | "completed";
  createdAt: string;
  updatedAt: string;
}

interface CampaignStatus {
  campaignId: number;
  total: number;
  statuses: {
    pending: number;
    dialing: number;
    completed: number;
    failed: number;
  };
  queueSize: number;
}

interface Prospect {
  id: number;
  campaignId: number;
  prospectId: number;
  status: string;
  callAttempts: number;
  lastAttemptAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const CampaignsPage: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [campaignStatus, setCampaignStatus] = useState<CampaignStatus | null>(null);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [form] = Form.useForm();

  // Récupérer les campagnes
  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const response = await axios.get("/api/campaigns");
      setCampaigns(response.data);
    } catch (error) {
      message.error("Erreur lors de la récupération des campagnes");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Récupérer le statut d'une campagne
  const fetchCampaignStatus = async (campaignId: number) => {
    try {
      const response = await axios.get(`/api/campaigns/${campaignId}/status`);
      setCampaignStatus(response.data);
    } catch (error) {
      console.error("Erreur lors de la récupération du statut", error);
    }
  };

  // Récupérer les prospects d'une campagne
  const fetchProspects = async (campaignId: number) => {
    try {
      const response = await axios.get(`/api/campaigns/${campaignId}/prospects`);
      setProspects(response.data);
    } catch (error) {
      console.error("Erreur lors de la récupération des prospects", error);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  // Créer une nouvelle campagne
  const handleCreateCampaign = async (values: any) => {
    try {
      const response = await axios.post("/api/campaigns", {
        name: values.name,
        description: values.description,
        status: "draft",
      });
      setCampaigns([...campaigns, response.data]);
      message.success("Campagne créée avec succès");
      setIsModalVisible(false);
      form.resetFields();
    } catch (error) {
      message.error("Erreur lors de la création de la campagne");
      console.error(error);
    }
  };

  // Démarrer une campagne
  const handleStartCampaign = async (campaignId: number) => {
    try {
      await axios.post(`/api/campaigns/${campaignId}/start`);
      message.success("Campagne démarrée");
      fetchCampaigns();
    } catch (error) {
      message.error("Erreur lors du démarrage de la campagne");
      console.error(error);
    }
  };

  // Arrêter une campagne
  const handleStopCampaign = async (campaignId: number) => {
    try {
      await axios.post(`/api/campaigns/${campaignId}/stop`);
      message.success("Campagne arrêtée");
      fetchCampaigns();
    } catch (error) {
      message.error("Erreur lors de l'arrêt de la campagne");
      console.error(error);
    }
  };

  // Supprimer une campagne
  const handleDeleteCampaign = async (campaignId: number) => {
    Modal.confirm({
      title: "Confirmer la suppression",
      content: "Êtes-vous sûr de vouloir supprimer cette campagne ?",
      okText: "Oui",
      cancelText: "Non",
      onOk: async () => {
        try {
          await axios.delete(`/api/campaigns/${campaignId}`);
          setCampaigns(campaigns.filter((c) => c.id !== campaignId));
          message.success("Campagne supprimée");
        } catch (error) {
          message.error("Erreur lors de la suppression");
          console.error(error);
        }
      },
    });
  };

  // Importer des prospects
  const handleImportProspects = async (values: any) => {
    const formData = new FormData();
    formData.append("campaignId", values.campaignId);
    formData.append("file", values.csvFile[0].originFileObj);

    try {
      await axios.post(`/api/campaigns/${values.campaignId}/import-prospects`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      message.success("Prospects importés avec succès");
      setIsImportModalVisible(false);
      fetchCampaigns();
    } catch (error) {
      message.error("Erreur lors de l'importation des prospects");
      console.error(error);
    }
  };

  // Afficher les détails d'une campagne
  const handleViewDetails = async (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    await fetchCampaignStatus(campaign.id);
    await fetchProspects(campaign.id);
    setIsDetailModalVisible(true);
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      draft: "default",
      active: "processing",
      paused: "warning",
      completed: "success",
      failed: "error",
      pending: "default",
      dialing: "processing",
    };
    return colors[status] || "default";
  };

  const columns = [
    {
      title: "Nom",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
    },
    {
      title: "Statut",
      dataIndex: "status",
      key: "status",
      render: (status: string) => <Tag color={getStatusColor(status)}>{status.toUpperCase()}</Tag>,
    },
    {
      title: "Créée le",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (date: string) => new Date(date).toLocaleDateString("fr-FR"),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, record: Campaign) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetails(record)}
          >
            Détails
          </Button>
          {record.status === "draft" && (
            <Button
              type="primary"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleStartCampaign(record.id)}
            >
              Démarrer
            </Button>
          )}
          {record.status === "active" && (
            <Button
              type="default"
              size="small"
              icon={<StopOutlined />}
              onClick={() => handleStopCampaign(record.id)}
            >
              Arrêter
            </Button>
          )}
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteCampaign(record.id)}
          >
            Supprimer
          </Button>
        </Space>
      ),
    },
  ];

  const prospectColumns = [
    {
      title: "ID Prospect",
      dataIndex: "prospectId",
      key: "prospectId",
    },
    {
      title: "Statut",
      dataIndex: "status",
      key: "status",
      render: (status: string) => <Tag color={getStatusColor(status)}>{status.toUpperCase()}</Tag>,
    },
    {
      title: "Tentatives",
      dataIndex: "callAttempts",
      key: "callAttempts",
    },
    {
      title: "Dernière tentative",
      dataIndex: "lastAttemptAt",
      key: "lastAttemptAt",
      render: (date: string) => (date ? new Date(date).toLocaleString("fr-FR") : "-"),
    },
  ];

  return (
    <div style={{ padding: "24px" }}>
      <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between" }}>
        <h1>Campagnes d'appels prédictifs</h1>
        <Space>
          <Button type="default" icon={<UploadOutlined />} onClick={() => setIsImportModalVisible(true)}>
            Importer Prospects
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)}>
            Nouvelle campagne
          </Button>
        </Space>
      </div>

      <Card loading={loading}>
        <Table dataSource={campaigns} columns={columns} rowKey="id" pagination={{ pageSize: 10 }} />
      </Card>

      {/* Modal de création */}
      <Modal
        title="Créer une nouvelle campagne"
        visible={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form form={form} onFinish={handleCreateCampaign} layout="vertical">
          <Form.Item
            label="Nom de la campagne"
            name="name"
            rules={[{ required: true, message: "Veuillez entrer le nom" }]}
          >
            <Input placeholder="Ex: Campagne Q1 2024" />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea placeholder="Description optionnelle" rows={3} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              Créer
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal de détails */}
      <Modal
        title={`Détails: ${selectedCampaign?.name}`}
        visible={isDetailModalVisible}
        onCancel={() => setIsDetailModalVisible(false)}
        width={1000}
        footer={null}
      >
        {campaignStatus && (
          <>
            <Row gutter={16} style={{ marginBottom: "24px" }}>
              <Col span={6}>
                <Statistic title="Total" value={campaignStatus.total} />
              </Col>
              <Col span={6}>
                <Statistic title="En attente" value={campaignStatus.statuses.pending} />
              </Col>
              <Col span={6}>
                <Statistic title="En cours" value={campaignStatus.statuses.dialing} />
              </Col>
              <Col span={6}>
                <Statistic title="Complétés" value={campaignStatus.statuses.completed} />
              </Col>
            </Row>

            <div style={{ marginBottom: "24px" }}>
              <h3>Progression</h3>
              <Progress
                percent={Math.round(
                  ((campaignStatus.statuses.completed + campaignStatus.statuses.failed) /
                    campaignStatus.total) *
                    100
                )}
              />
            </div>

            <h3>Prospects</h3>
            <Table
              dataSource={prospects}
              columns={prospectColumns}
              rowKey="id"
              pagination={{ pageSize: 5 }}
            />
          </>
        )}
      </Modal>

      {/* Modal d'importation CSV */}
      <Modal
        title="Importer des prospects par CSV"
        visible={isImportModalVisible}
        onCancel={() => setIsImportModalVisible(false)}
        footer={null}
      >
        <Form onFinish={handleImportProspects} layout="vertical">
          <Form.Item
            label="Sélectionner une campagne"
            name="campaignId"
            rules={[{ required: true, message: "Veuillez sélectionner une campagne" }]}
          >
            <Select placeholder="Sélectionnez une campagne">
              {campaigns.map((campaign) => (
                <Select.Option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="Fichier CSV"
            name="csvFile"
            valuePropName="fileList"
            getValueFromEvent={(e) => (Array.isArray(e) ? e : e && e.fileList)}
            rules={[{ required: true, message: "Veuillez télécharger un fichier CSV" }]}
          >
            <Upload.Dragger
              name="file"
              multiple={false}
              accept=".csv"
              beforeUpload={() => false} // Empêche l'upload automatique
            >
              <p className="ant-upload-drag-icon">
                <UploadOutlined />
              </p>
              <p className="ant-upload-text">Cliquez ou glissez-déposez un fichier CSV ici</p>
              <p className="ant-upload-hint">Supporte uniquement les fichiers CSV</p>
            </Upload.Dragger>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              Importer
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CampaignsPage;
