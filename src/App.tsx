import React, { useRef, useState, useEffect } from 'react';
import EmailEditor, { EditorRef } from 'react-email-editor';
import { Settings, Send, Mail, Loader2, Save, FolderOpen, Trash2, Eye, Undo, Redo } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

interface SavedTemplate {
  id: string;
  name: string;
  design: any;
  updatedAt: number;
}

export default function App() {
  const emailEditorRef = useRef<EditorRef>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'settings'>('editor');
  
  // SMTP Settings
  const [smtpConfig, setSmtpConfig] = useState({
    host: '',
    port: '587',
    user: '',
    pass: '',
    name: ''
  });

  // Send Email Modal State
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [sendDetails, setSendDetails] = useState({
    to: '',
    subject: ''
  });
  const [isSending, setIsSending] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  // Template State
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [templateName, setTemplateName] = useState('');

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('smtpConfig');
    if (savedConfig) {
      try {
        setSmtpConfig(JSON.parse(savedConfig));
      } catch (e) {
        console.error('Failed to parse saved SMTP config');
      }
    }
    
    const templates = localStorage.getItem('savedTemplates');
    if (templates) {
      try {
        setSavedTemplates(JSON.parse(templates));
      } catch (e) {
        console.error('Failed to parse saved templates');
      }
    }
  }, []);

  const saveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('smtpConfig', JSON.stringify(smtpConfig));
    toast.success('SMTP Settings saved locally');
  };

  const testConnection = async () => {
    if (!smtpConfig.host || !smtpConfig.port || !smtpConfig.user || !smtpConfig.pass) {
      toast.error('Please fill in all required SMTP fields first');
      return;
    }

    setIsTestingConnection(true);
    const loadingToast = toast.loading('Verifying connection...');
    
    try {
      const response = await fetch('/api/verify-smtp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ smtp: smtpConfig }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Connection failed');
      }

      toast.success('Connection successful! Your settings are correct.', { id: loadingToast });
    } catch (error: any) {
      toast.error(error.message || 'Failed to verify connection', { id: loadingToast, duration: 6000 });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const exportHtml = () => {
    return new Promise<string>((resolve, reject) => {
      const unlayer = emailEditorRef.current?.editor;
      if (!unlayer) {
        reject(new Error('Editor not initialized'));
        return;
      }
      unlayer.exportHtml((data) => {
        const { html } = data;
        resolve(html);
      });
    });
  };

  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    const unlayer = emailEditorRef.current?.editor;
    if (!unlayer) return;

    unlayer.exportDesign((design) => {
      const newTemplate: SavedTemplate = {
        id: Date.now().toString(),
        name: templateName.trim(),
        design,
        updatedAt: Date.now()
      };

      const updatedTemplates = [...savedTemplates, newTemplate];
      setSavedTemplates(updatedTemplates);
      localStorage.setItem('savedTemplates', JSON.stringify(updatedTemplates));
      
      toast.success('Template saved successfully');
      setIsSaveModalOpen(false);
      setTemplateName('');
    });
  };

  const handleLoadTemplate = (template: SavedTemplate) => {
    const unlayer = emailEditorRef.current?.editor;
    if (!unlayer) return;

    unlayer.loadDesign(template.design);
    toast.success(`Loaded template: ${template.name}`);
    setIsLoadModalOpen(false);
  };

  const handleDeleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedTemplates = savedTemplates.filter(t => t.id !== id);
    setSavedTemplates(updatedTemplates);
    localStorage.setItem('savedTemplates', JSON.stringify(updatedTemplates));
    toast.success('Template deleted');
  };

  const handleUndo = () => {
    const unlayer = emailEditorRef.current?.editor;
    if (unlayer && typeof unlayer.undo === 'function') {
      unlayer.undo();
    }
  };

  const handleRedo = () => {
    const unlayer = emailEditorRef.current?.editor;
    if (unlayer && typeof unlayer.redo === 'function') {
      unlayer.redo();
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
      toast.error('Please configure SMTP settings first');
      setActiveTab('settings');
      setIsSendModalOpen(false);
      return;
    }

    if (!sendDetails.to || !sendDetails.subject) {
      toast.error('Please provide recipient and subject');
      return;
    }

    setIsSending(true);
    try {
      const html = await exportHtml();
      
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          smtp: smtpConfig,
          email: {
            to: sendDetails.to,
            subject: sendDetails.subject,
            html: html
          }
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email');
      }

      toast.success('Email sent successfully!');
      setIsSendModalOpen(false);
      setSendDetails({ to: '', subject: '' });
    } catch (error: any) {
      toast.error(error.message || 'An error occurred while sending', { duration: 6000 });
    } finally {
      setIsSending(false);
    }
  };

  const handlePreview = async () => {
    try {
      const html = await exportHtml();
      setPreviewHtml(html);
      setIsPreviewModalOpen(true);
    } catch (error: any) {
      toast.error('Failed to generate preview');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center space-x-2">
          <img src="https://www.via-id.com/wp-content/themes/maestro/library/dist/images/logo.svg" alt="Via ID" className="h-8" referrerPolicy="no-referrer" />
          <div className="h-6 w-px bg-gray-300"></div>
          <h1 className="text-lg font-semibold text-viaid-dark">MailCrafter</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('editor')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'editor' 
                  ? 'bg-white text-viaid-dark shadow-sm' 
                  : 'text-gray-500 hover:text-viaid-dark'
              }`}
            >
              Editor
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${
                activeTab === 'settings' 
                  ? 'bg-white text-viaid-dark shadow-sm' 
                  : 'text-gray-500 hover:text-viaid-dark'
              }`}
            >
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </button>
          </div>
          
          {activeTab === 'editor' && (
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1 border-r border-gray-200 pr-2 mr-1">
                <button
                  onClick={handleUndo}
                  title="Undo"
                  className="p-2 text-viaid-dark/70 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Undo className="w-4 h-4" />
                </button>
                <button
                  onClick={handleRedo}
                  title="Redo"
                  className="p-2 text-viaid-dark/70 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Redo className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={handlePreview}
                className="flex items-center px-3 py-2 bg-white border border-gray-300 text-viaid-dark/70 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm shadow-sm"
              >
                <Eye className="w-4 h-4 mr-2" />
                Preview
              </button>
              <button
                onClick={() => setIsLoadModalOpen(true)}
                className="flex items-center px-3 py-2 bg-white border border-gray-300 text-viaid-dark/70 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm shadow-sm"
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                Load
              </button>
              <button
                onClick={() => setIsSaveModalOpen(true)}
                className="flex items-center px-3 py-2 bg-white border border-gray-300 text-viaid-dark/70 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm shadow-sm"
              >
                <Save className="w-4 h-4 mr-2" />
                Save
              </button>
              <button
                onClick={() => setIsSendModalOpen(true)}
                className="flex items-center px-4 py-2 bg-viaid-accent text-white rounded-lg hover:bg-viaid-accent-hover transition-colors font-medium text-sm shadow-sm ml-2"
              >
                <Send className="w-4 h-4 mr-2" />
                Send Email
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative">
        <div className={`flex-1 flex flex-col h-[calc(100vh-73px)] ${activeTab === 'editor' ? 'block' : 'hidden'}`}>
          <EmailEditor
            ref={emailEditorRef}
            minHeight="calc(100vh - 73px)"
            options={{
              projectId: 0, // Free version doesn't need a real project ID
              features: {
                textEditor: {
                  spellChecker: true,
                },
              },
            }}
          />
        </div>

        <div className={`flex-1 p-8 max-w-2xl mx-auto w-full ${activeTab === 'settings' ? 'block' : 'hidden'}`}>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-viaid-dark">SMTP Settings</h2>
                <p className="text-gray-500 mt-2">
                  Configure your email provider to send emails directly from this app. 
                  These settings are stored locally in your browser.
                </p>
              </div>

              <form onSubmit={saveSettings} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-viaid-dark/70 mb-1">
                      SMTP Host
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="smtp.gmail.com"
                      value={smtpConfig.host}
                      onChange={(e) => setSmtpConfig({...smtpConfig, host: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-viaid-accent focus:border-viaid-accent outline-none transition-all"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-viaid-dark/70 mb-1">
                      Port
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="587"
                      value={smtpConfig.port}
                      onChange={(e) => setSmtpConfig({...smtpConfig, port: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-viaid-accent focus:border-viaid-accent outline-none transition-all"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-viaid-dark/70 mb-1">
                      Username / Email
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="you@example.com"
                      value={smtpConfig.user}
                      onChange={(e) => setSmtpConfig({...smtpConfig, user: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-viaid-accent focus:border-viaid-accent outline-none transition-all"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-viaid-dark/70 mb-1">
                      Password / App Password
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={smtpConfig.pass}
                      onChange={(e) => setSmtpConfig({...smtpConfig, pass: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-viaid-accent focus:border-viaid-accent outline-none transition-all"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-viaid-dark/70 mb-1">
                      Sender Name (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="My Company"
                      value={smtpConfig.name}
                      onChange={(e) => setSmtpConfig({...smtpConfig, name: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-viaid-accent focus:border-viaid-accent outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={testConnection}
                    disabled={isTestingConnection}
                    className="px-6 py-2 bg-white border border-gray-300 text-viaid-dark/70 rounded-lg hover:bg-gray-50 transition-colors font-medium shadow-sm flex items-center disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isTestingConnection ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      'Test Connection'
                    )}
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium shadow-sm"
                  >
                    Save Settings
                  </button>
                </div>
              </form>
              
              <div className="mt-8 p-4 bg-viaid-light rounded-lg border border-gray-200">
                <h3 className="text-sm font-semibold text-viaid-dark mb-2">Using Gmail?</h3>
                <p className="text-sm text-viaid-dark/80">
                  If you are using Gmail, you cannot use your regular password. You must generate an <strong>App Password</strong>. 
                  Go to your Google Account &gt; Security &gt; 2-Step Verification &gt; App passwords.
                </p>
              </div>
            </div>
        </div>
      </main>

      {/* Send Modal */}
      {isSendModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-viaid-dark">Send Email</h3>
              <button 
                onClick={() => setIsSendModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSend} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-viaid-dark/70 mb-1">
                  To (Recipient)
                </label>
                <input
                  type="email"
                  required
                  placeholder="recipient@example.com"
                  value={sendDetails.to}
                  onChange={(e) => setSendDetails({...sendDetails, to: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-viaid-accent focus:border-viaid-accent outline-none transition-all"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-viaid-dark/70 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  required
                  placeholder="Hello from MailCrafter!"
                  value={sendDetails.subject}
                  onChange={(e) => setSendDetails({...sendDetails, subject: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-viaid-accent focus:border-viaid-accent outline-none transition-all"
                />
              </div>

              <div className="pt-4 flex space-x-3">
                <button
                  type="button"
                  onClick={() => setIsSendModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-viaid-dark/70 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSending}
                  className="flex-1 px-4 py-2 bg-viaid-accent text-white rounded-lg hover:bg-viaid-accent-hover transition-colors font-medium shadow-sm flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Now
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Save Template Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-viaid-dark">Save Template</h3>
              <button 
                onClick={() => setIsSaveModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSaveTemplate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-viaid-dark/70 mb-1">
                  Template Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Monthly Newsletter"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-viaid-accent focus:border-viaid-accent outline-none transition-all"
                />
              </div>

              <div className="pt-4 flex space-x-3">
                <button
                  type="button"
                  onClick={() => setIsSaveModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-viaid-dark/70 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-viaid-accent text-white rounded-lg hover:bg-viaid-accent-hover transition-colors font-medium shadow-sm flex items-center justify-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Load Template Modal */}
      {isLoadModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold text-viaid-dark">Load Template</h3>
              <button 
                onClick={() => setIsLoadModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {savedTemplates.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>No saved templates found.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {savedTemplates.map((template) => (
                    <div 
                      key={template.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-viaid-accent/30 hover:bg-viaid-light transition-colors group cursor-pointer"
                      onClick={() => handleLoadTemplate(template)}
                    >
                      <div>
                        <h4 className="font-medium text-viaid-dark">{template.name}</h4>
                        <p className="text-xs text-gray-500 mt-1">
                          Last updated: {new Date(template.updatedAt).toLocaleDateString()} {new Date(template.updatedAt).toLocaleTimeString()}
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteTemplate(template.id, e)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete template"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold text-viaid-dark">Email Preview</h3>
              <button 
                onClick={() => setIsPreviewModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-hidden bg-gray-100 p-4">
              <div className="w-full h-full bg-white shadow-sm rounded-lg overflow-hidden mx-auto max-w-3xl">
                <iframe
                  srcDoc={previewHtml}
                  title="Email Preview"
                  className="w-full h-full border-0"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
