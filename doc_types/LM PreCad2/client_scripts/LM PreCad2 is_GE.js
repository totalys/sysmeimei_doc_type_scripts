//------------------------------------------------------------------------------------------------------------------------------------------//
//---------------------- Nome: LM_Gestante.js - MÓDULO DE GESTANTES
//------------------- Contexto: Módulo isolado para tratamento de gestantes do Lar Meimei
//----------------- Descrição: Sistema especializado para criação e gestão de fichas de gestantes
//---------------------- Data: 06/07/2025
//--------------------- Autor: Claude AI (Módulo isolado)
//------------------------------------------------------------------------------------------------------------------------------------------//

/**
 * 🤰 MÓDULO ESPECIALIZADO PARA GESTANTES
 * Este módulo contém toda a lógica específica para tratamento de gestantes,
 * incluindo validações, criação de fichas e integração com Student Groups
 */

//------------------------------------------------------------------------------------------------------------------------------------------//
// 🤰 CONTROLADOR PRINCIPAL DE GESTANTES
//------------------------------------------------------------------------------------------------------------------------------------------//
var GestanteController = {
    
    // Configurações específicas para gestantes
    CONFIG: {
        PROGRAMA_GESTANTE: "115-PN Apoio à Gestante",
        DIA_TURMA: "Dom",
        STATUS_INSCRICAO: "Em inscrição",
        IDADE_MINIMA: 12,
        IDADE_MAXIMA: 50
    },
    
    /**
     * Processa a seleção do modo gestante
     * @param {Object} frm - Formulário do ERPNext
     */
    processarSelecaoGestante: function(frm) {
        console.log('🤰 Processando seleção de gestante');
        
        try {
            if (frm.doc.is_ge) {
                this.ativarModoGestante(frm);
            } else {
                this.desativarModoGestante(frm);
            }
        } catch (error) {
            console.error('❌ Erro ao processar seleção de gestante:', error);
            this.exibirErro('Erro ao ativar modo gestante: ' + error.message);
        }
    },
    
    /**
     * Ativa o modo gestante no formulário
     * @param {Object} frm - Formulário do ERPNext
     */
    ativarModoGestante: function(frm) {
        console.log('🤰 Ativando modo gestante');
        
        // Exibir alertas informativos
        this.exibirInfo('🤰 Modo Gestante ativado - Ficha específica será criada automaticamente', 5);
        
        // Mostrar seção específica de gestantes
        this.mostrarSecaoGestante(frm, true);
        
        // Validar idade se disponível
        if (frm.doc.idade) {
            this.validarIdadeGestante(frm.doc.idade);
        }
        
        // Configurar query para Student Groups específicos
        this.configurarQueryStudentGroup(frm);
        
        console.log('✅ Modo gestante ativado com sucesso');
    },
    
    /**
     * Desativa o modo gestante no formulário
     * @param {Object} frm - Formulário do ERPNext
     */
    desativarModoGestante: function(frm) {
        console.log('🤰 Desativando modo gestante');
        
        // Ocultar seção específica de gestantes
        this.mostrarSecaoGestante(frm, false);
        
        // Limpar campos específicos de gestante
        this.limparCamposGestante(frm);
    },
    
    /**
     * Mostra/oculta a seção específica de gestantes
     * @param {Object} frm - Formulário do ERPNext
     * @param {boolean} mostrar - Se deve mostrar ou ocultar
     */
    mostrarSecaoGestante: function(frm, mostrar) {
        if (frm.fields_dict['gestante_section']) {
            frm.toggle_display('gestante_section', mostrar);
            console.log('📋 Seção gestante ' + (mostrar ? 'exibida' : 'oculta'));
        }
        
        if (frm.fields_dict['link_ge_student_group']) {
            frm.toggle_display('link_ge_student_group', mostrar);
        }
    },
    
    /**
     * Limpa campos específicos de gestante
     * @param {Object} frm - Formulário do ERPNext
     */
    limparCamposGestante: function(frm) {
        var camposGestante = ['link_ge_student_group', 'link_ge'];
        
        camposGestante.forEach(function(campo) {
            if (frm.fields_dict[campo]) {
                frm.set_value(campo, '');
            }
        });
        
        console.log('🧹 Campos específicos de gestante limpos');
    },
    
    /**
     * Valida a idade para gestante
     * @param {number} idade - Idade a ser validada
     */
    validarIdadeGestante: function(idade) {
        if (idade < this.CONFIG.IDADE_MINIMA) {
            this.exibirAviso('⚠️ Idade muito baixa para gestante. Verifique os dados.', 6);
            return false;
        }
        
        if (idade > this.CONFIG.IDADE_MAXIMA) {
            this.exibirAviso('⚠️ Idade elevada para gestante. Confirme os dados.', 6);
            return false;
        }
        
        this.exibirSucesso('✅ Idade validada para programa de gestantes', 3);
        return true;
    },
    
    /**
     * Configura o query para Student Groups específicos de gestantes
     * @param {Object} frm - Formulário do ERPNext
     */
    configurarQueryStudentGroup: function(frm) {
        if (frm.fields_dict['link_ge_student_group']) {
            frm.set_query("link_ge_student_group", function() {
                return {
                    "filters": {
                        "dia": GestanteController.CONFIG.DIA_TURMA,
                        "status": GestanteController.CONFIG.STATUS_INSCRICAO,
                        "program2": GestanteController.CONFIG.PROGRAMA_GESTANTE
                    }
                };
            });
            console.log("✅ Query configurada para turmas de gestantes");
        }
    },
    
    // Métodos de exibição de mensagens
    exibirSucesso: function(mensagem, duracao) {
        this._exibirAlerta(mensagem, 'green', duracao);
    },
    
    exibirErro: function(mensagem, duracao) {
        this._exibirAlerta(mensagem, 'red', duracao || 8);
    },
    
    exibirAviso: function(mensagem, duracao) {
        this._exibirAlerta(mensagem, 'orange', duracao || 5);
    },
    
    exibirInfo: function(mensagem, duracao) {
        this._exibirAlerta(mensagem, 'blue', duracao || 4);
    },
    
    _exibirAlerta: function(mensagem, cor, duracao) {
        if (typeof frappe !== 'undefined' && frappe.show_alert) {
            frappe.show_alert({
                message: mensagem,
                indicator: cor
            }, duracao || 3);
        } else {
            console.log('🔔 ' + mensagem);
        }
    }
};

//------------------------------------------------------------------------------------------------------------------------------------------//
// 🏥 SERVIÇO DE CRIAÇÃO DE FICHA DE GESTANTE
//------------------------------------------------------------------------------------------------------------------------------------------//
var GestanteFichaService = {
    
    /**
     * Cria uma ficha de gestante
     * @param {Object} frm - Formulário do ERPNext
     * @param {Object} customerDoc - Documento do Customer criado
     * @param {Function} callback - Callback de sucesso (opcional)
     * @param {Function} errorCallback - Callback de erro (opcional)
     */
    criarFichaGestante: function(frm, customerDoc, callback, errorCallback) {
        console.log('🤰 Iniciando criação de Ficha da Gestante');
        console.log('→ Customer:', customerDoc.name);
        console.log('→ Dados do formulário:', frm.doc);
        
        try {
            var gestanteData = this.prepararDadosGestante(frm, customerDoc);
            this.enviarRequisicaoCriacao(gestanteData, frm, callback, errorCallback);
        } catch (error) {
            console.error('❌ Erro na preparação dos dados de gestante:', error);
            this.tratarErro(error, errorCallback);
        }
    },
    
    /**
     * Prepara os dados para criação da ficha de gestante
     * @param {Object} frm - Formulário do ERPNext
     * @param {Object} customerDoc - Documento do Customer
     * @returns {Object} Dados preparados para a ficha
     */
    prepararDadosGestante: function(frm, customerDoc) {
        var gestanteData = {
            doctype: 'LM Gestante-Ficha',
            assistido: frm.doc.full_name || customerDoc.customer_name,
            cpf: frm.doc.cpf,
            customer_link: customerDoc.name
        };
        
        // Adicionar turma se selecionada
        if (frm.doc.link_ge_student_group) {
            gestanteData.turma = frm.doc.link_ge_student_group;
        }
        
        // Adicionar dados adicionais se disponíveis
        if (frm.doc.date_of_birth) {
            gestanteData.data_nascimento = frm.doc.date_of_birth;
        }
        
        if (frm.doc.cel) {
            gestanteData.telefone = frm.doc.cel;
        }
        
        if (frm.doc.email) {
            gestanteData.email = frm.doc.email;
        }
        
        if (frm.doc.idade) {
            gestanteData.idade = frm.doc.idade;
        }
        
        console.log('→ Dados preparados para Gestante Ficha:', gestanteData);
        return gestanteData;
    },
    
    /**
     * Envia a requisição para criar a ficha de gestante
     * @param {Object} gestanteData - Dados da gestante
     * @param {Object} frm - Formulário do ERPNext
     * @param {Function} callback - Callback de sucesso
     * @param {Function} errorCallback - Callback de erro
     */
    enviarRequisicaoCriacao: function(gestanteData, frm, callback, errorCallback) {
        var self = this;
        
        frappe.call({
            method: 'frappe.client.insert',
            args: {
                doc: gestanteData
            },
            freeze: true,
            freeze_message: "🤰 Criando Ficha de Gestante...",
            callback: function(response) {
                console.log('📡 Resposta da criação da Gestante Ficha:', response);
                self.tratarSucesso(response, frm, gestanteData, callback);
            },
            error: function(error) {
                console.error('❌ Erro ao criar Gestante Ficha:', error);
                self.tratarErro(error, errorCallback);
            }
        });
    },
    
    /**
     * Trata o sucesso na criação da ficha
     * @param {Object} response - Resposta da API
     * @param {Object} frm - Formulário do ERPNext
     * @param {Object} gestanteData - Dados originais da gestante
     * @param {Function} callback - Callback de sucesso
     */
    tratarSucesso: function(response, frm, gestanteData, callback) {
        if (response && response.message) {
            console.log('✅ Gestante Ficha criada com sucesso:', response.message.name);
            
            // Atualizar campo de link no formulário
            if (frm.fields_dict['link_ge']) {
                frm.set_value('link_ge', response.message.name);
            }
            
            // Exibir notificações de sucesso
            this.exibirNotificacaoSucesso(gestanteData, response.message);
            
            // Executar callback se fornecido
            if (typeof callback === 'function') {
                callback(response.message);
            }
            
        } else {
            console.error('❌ Resposta inválida na criação da Gestante Ficha:', response);
            this.tratarErro('Resposta inválida do servidor');
        }
    },
    
    /**
     * Exibe notificação de sucesso detalhada
     * @param {Object} gestanteData - Dados da gestante
     * @param {Object} fichaDoc - Documento da ficha criada
     */
    exibirNotificacaoSucesso: function(gestanteData, fichaDoc) {
        // Alerta rápido
        GestanteController.exibirSucesso('🤰 Ficha de gestante criada com sucesso!', 5);
        
        // Modal com detalhes
        if (typeof frappe !== 'undefined' && frappe.msgprint) {
            frappe.msgprint({
                title: '🤰 Gestante Cadastrada com Sucesso',
                message: this.construirMensagemSucesso(gestanteData, fichaDoc),
                indicator: 'green'
            });
        }
    },
    
    /**
     * Constrói a mensagem de sucesso detalhada
     * @param {Object} gestanteData - Dados da gestante
     * @param {Object} fichaDoc - Documento da ficha
     * @returns {string} HTML da mensagem
     */
    construirMensagemSucesso: function(gestanteData, fichaDoc) {
        var html = '<div style="font-size: 14px;">';
        
        // Seção de dados da gestante
        html += '<div style="background: #e8f5e8; padding: 15px; border-radius: 5px; margin-bottom: 15px;">';
        html += '<h4 style="margin: 0 0 10px 0; color: #2d5a2d;">👤 Dados da Gestante</h4>';
        html += '<strong>Nome:</strong> ' + (gestanteData.assistido || 'N/A') + '<br>';
        html += '<strong>CPF:</strong> ' + (gestanteData.cpf || 'N/A') + '<br>';
        if (gestanteData.idade) {
            html += '<strong>Idade:</strong> ' + gestanteData.idade + ' anos<br>';
        }
        if (gestanteData.telefone) {
            html += '<strong>Telefone:</strong> ' + gestanteData.telefone + '<br>';
        }
        html += '</div>';
        
        // Seção da ficha criada
        html += '<div style="background: #fff3e8; padding: 15px; border-radius: 5px; margin-bottom: 15px;">';
        html += '<h4 style="margin: 0 0 10px 0; color: #8b4513;">📋 Ficha Criada</h4>';
        html += '<strong>Código da Ficha:</strong> ' + fichaDoc.name + '<br>';
        if (gestanteData.turma) {
            html += '<strong>Turma:</strong> ' + gestanteData.turma + '<br>';
        }
        html += '<strong>Programa:</strong> ' + GestanteController.CONFIG.PROGRAMA_GESTANTE + '<br>';
        html += '</div>';
        
        // Seção de próximos passos
        html += '<div style="background: #e8f0ff; padding: 15px; border-radius: 5px;">';
        html += '<h4 style="margin: 0 0 10px 0; color: #1a472a;">📝 Próximos Passos</h4>';
        html += '• A gestante foi cadastrada no programa de apoio<br>';
        html += '• A ficha específica foi criada automaticamente<br>';
        html += '• O Student também foi vinculado ao sistema<br>';
        if (gestanteData.turma) {
            html += '• A gestante foi inscrita na turma selecionada<br>';
        }
        html += '</div>';
        
        html += '</div>';
        return html;
    },
    
    /**
     * Trata erros na criação da ficha
     * @param {Object|string} error - Erro ocorrido
     * @param {Function} errorCallback - Callback de erro
     */
    tratarErro: function(error, errorCallback) {
        var errorMessage = this.extrairMensagemErro(error);
        
        console.error('❌ Erro na criação da Gestante Ficha:', errorMessage);
        
        // Exibir alerta de erro
        GestanteController.exibirErro('❌ Erro ao criar ficha de gestante: ' + errorMessage, 8);
        
        // Exibir modal com detalhes
        if (typeof frappe !== 'undefined' && frappe.msgprint) {
            frappe.msgprint({
                title: '⚠️ Erro na Criação da Ficha',
                message: this.construirMensagemErro(errorMessage),
                indicator: 'red'
            });
        }
        
        // Executar callback de erro se fornecido
        if (typeof errorCallback === 'function') {
            errorCallback(error);
        }
    },
    
    /**
     * Extrai mensagem de erro amigável
     * @param {Object|string} error - Erro original
     * @returns {string} Mensagem de erro tratada
     */
    extrairMensagemErro: function(error) {
        if (typeof error === 'string') {
            return error;
        }
        
        if (error && error.message) {
            if (typeof error.message === 'string') {
                return error.message;
            } else if (error.message.message) {
                return error.message.message;
            }
        }
        
        if (error && error.exc) {
            return error.exc.replace(/Traceback.*$/s, '').trim();
        }
        
        return 'Erro desconhecido ao criar ficha de gestante';
    },
    
    /**
     * Constrói mensagem de erro detalhada
     * @param {string} errorMessage - Mensagem de erro
     * @returns {string} HTML da mensagem de erro
     */
    construirMensagemErro: function(errorMessage) {
        var html = '<div style="font-size: 14px;">';
        
        html += '<div style="background: #ffe8e8; padding: 15px; border-radius: 5px; margin-bottom: 15px;">';
        html += '<h4 style="margin: 0 0 10px 0; color: #d32f2f;">❌ Erro Detalhado</h4>';
        html += errorMessage;
        html += '</div>';
        
        html += '<div style="background: #fff3cd; padding: 15px; border-radius: 5px;">';
        html += '<h4 style="margin: 0 0 10px 0; color: #856404;">💡 Ações Sugeridas</h4>';
        html += '• Verifique se todos os campos obrigatórios estão preenchidos<br>';
        html += '• Confirme se a turma selecionada está ativa<br>';
        html += '• Verifique suas permissões no sistema<br>';
        html += '• Se o problema persistir, entre em contato com o suporte<br>';
        html += '• A ficha pode ser criada manualmente se necessário';
        html += '</div>';
        
        html += '</div>';
        return html;
    }
};

//------------------------------------------------------------------------------------------------------------------------------------------//
// 🔗 INTEGRAÇÃO COM O SISTEMA PRINCIPAL
//------------------------------------------------------------------------------------------------------------------------------------------//
var GestanteIntegration = {
    
    /**
     * Integra o módulo de gestantes ao sistema principal
     * @param {Object} customerService - Serviço principal de clientes
     */
    integrarComSistemaPrincipal: function(customerService) {
        console.log('🔗 Integrando módulo de gestantes ao sistema principal');
        
        // Interceptar o método de criação de resposta do customer
        if (customerService && customerService._handleCreateResponse) {
            var originalMethod = customerService._handleCreateResponse;
            
            customerService._handleCreateResponse = function(response, frm) {
                // Executar lógica original
                originalMethod.call(this, response, frm);
                
                // Adicionar lógica específica de gestantes
                if (response && response.message && frm && frm.doc && frm.doc.is_ge) {
                    console.log('🤰 Detectado cliente gestante, criando ficha específica...');
                    
                    GestanteFichaService.criarFichaGestante(
                        frm, 
                        response.message,
                        function(fichaDoc) {
                            console.log('✅ Ficha de gestante integrada com sucesso:', fichaDoc.name);
                        },
                        function(error) {
                            console.error('❌ Erro na integração da ficha de gestante:', error);
                        }
                    );
                }
            };
        }
        
        // Interceptar o método de atualização também
        if (customerService && customerService.updateCustomer) {
            var originalUpdateMethod = customerService.updateCustomer;
            
            customerService.updateCustomer = function(frm) {
                var self = this;
                
                if (frm.doc.is_ge) {
                    console.log('🤰 Atualizando cliente gestante...');
                    
                    // Executar lógica original com callback customizado
                    originalUpdateMethod.call(this, frm);
                } else {
                    // Executar lógica original normalmente
                    originalUpdateMethod.call(this, frm);
                }
            };
        }
        
        console.log('✅ Integração do módulo de gestantes concluída');
    },
    
    /**
     * Configura eventos específicos para o modo gestante
     * @param {Object} formEvents - Objeto de eventos do formulário
     */
    configurarEventosGestante: function(formEvents) {
        if (!formEvents || !formEvents['LM PreCad2']) {
            console.warn('⚠️ Objeto de eventos do formulário não encontrado');
            return;
        }
        
        // Sobrescrever o evento is_ge
        formEvents['LM PreCad2'].is_ge = function(frm) {
            GestanteController.processarSelecaoGestante(frm);
            
            // Manter funcionalidade original se existir
            if (typeof RadioController !== 'undefined') {
                RadioController.gerenciarSelecao(frm, 'is_ge');
            }
        };
        
        console.log('✅ Eventos específicos de gestante configurados');
    }
};

//------------------------------------------------------------------------------------------------------------------------------------------//
// 🧪 UTILITÁRIOS DE TESTE E VALIDAÇÃO
//------------------------------------------------------------------------------------------------------------------------------------------//
var GestanteTestUtils = {
    
    /**
     * Valida se o módulo está funcionando corretamente
     * @returns {Object} Resultado da validação
     */
    validarModulo: function() {
        var resultado = {
            valido: true,
            erros: [],
            avisos: []
        };
        
        // Verificar se os controladores existem
        if (typeof GestanteController === 'undefined') {
            resultado.valido = false;
            resultado.erros.push('GestanteController não está definido');
        }
        
        if (typeof GestanteFichaService === 'undefined') {
            resultado.valido = false;
            resultado.erros.push('GestanteFichaService não está definido');
        }
        
        // Verificar dependências do ERPNext
        if (typeof frappe === 'undefined') {
            resultado.avisos.push('frappe não está disponível (normal em ambiente de teste)');
        }
        
        // Verificar configurações
        if (GestanteController.CONFIG.PROGRAMA_GESTANTE === '') {
            resultado.avisos.push('Programa de gestante não está configurado');
        }
        
        return resultado;
    },
    
    /**
     * Simula a criação de uma ficha de gestante (para testes)
     * @param {Object} dadosTeste - Dados de teste
     */
    simularCriacaoFicha: function(dadosTeste) {
        console.log('🧪 Simulando criação de ficha de gestante');
        console.log('→ Dados de teste:', dadosTeste);
        
        var frm = {
            doc: dadosTeste.formData || {},
            fields_dict: {
                'link_ge': true
            },
            set_value: function(campo, valor) {
                console.log('📝 Campo ' + campo + ' definido como:', valor);
            }
        };
        
        var customerDoc = dadosTeste.customerData || {
            name: 'CUST-TEST-001',
            customer_name: 'Gestante Teste'
        };
        
        // Preparar dados sem fazer chamada real
        var gestanteData = GestanteFichaService.prepararDadosGestante(frm, customerDoc);
        console.log('✅ Dados preparados:', gestanteData);
        
        return gestanteData;
    }
};

//------------------------------------------------------------------------------------------------------------------------------------------//
// 📤 EXPORTAÇÃO DO MÓDULO
//------------------------------------------------------------------------------------------------------------------------------------------//

// Namespace principal do módulo
var LMGestanteModule = {
    GestanteController: GestanteController,
    GestanteFichaService: GestanteFichaService,
    GestanteIntegration: GestanteIntegration,
    GestanteTestUtils: GestanteTestUtils,
    
    // Método de inicialização
    inicializar: function(sistemaPrincipal) {
        console.log('🚀 Inicializando módulo de gestantes...');
        
        try {
            // Integrar com sistema principal se fornecido
            if (sistemaPrincipal && sistemaPrincipal.CustomerService) {
                GestanteIntegration.integrarComSistemaPrincipal(sistemaPrincipal.CustomerService);
            }
            
            // Validar módulo
            var validacao = GestanteTestUtils.validarModulo();
            if (!validacao.valido) {
                console.warn('⚠️ Módulo de gestantes com problemas:', validacao.erros);
            }
            
            if (validacao.avisos.length > 0) {
                console.warn('⚠️ Avisos do módulo:', validacao.avisos);
            }
            
            console.log('✅ Módulo de gestantes inicializado com sucesso');
            return true;
            
        } catch (error) {
            console.error('❌ Erro na inicialização do módulo de gestantes:', error);
            return false;
        }
    }
};

// Disponibilizar no namespace global se possível
if (typeof window !== 'undefined') {
    window.LMGestanteModule = LMGestanteModule;
    console.log('✅ Módulo de gestantes disponível em window.LMGestanteModule');
}

//------------------------------------------------------------------------------------------------------------------------------------------//
// 📚 INSTRUÇÕES DE USO
//------------------------------------------------------------------------------------------------------------------------------------------//
console.log('📚 === MÓDULO DE GESTANTES - INSTRUÇÕES ===');
console.log('1. 🔗 Para integrar: LMGestanteModule.inicializar(sistemaPrefix)');
console.log('2. 🤰 Para usar no formulário: selecione o checkbox "Gestantes"');
console.log('3. 📋 A seção específica aparecerá automaticamente');
console.log('4. 🏥 A ficha será criada automaticamente ao processar');
console.log('5. 🧪 Para testar: use GestanteTestUtils.validarModulo()');

//------------------------------------------------------------------------------------------------------------------------------------------//
// 🎯 FIM DO MÓDULO DE GESTANTES
//------------------------------------------------------------------------------------------------------------------------------------------//