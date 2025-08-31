/**
 * ===== SCRIPT AUTÔNOMO FINAL CORRIGIDO =====
 * Versão: 10.6 - Script Independente + Links no Customer
 * Data: 2025-07-26
 * 
 * NOVA FUNCIONALIDADE: Salva link-st, link-ge e link-cr no customer após criação
 * Uso: LMPreCad2Processor.processar(frm, dadosPreparados)
 */
window.LMPreCad2Processor = (function() {
    'use strict';
    
    // ===== CONFIGURAÇÕES =====
    var CONFIG = {
        version: '10.6-CUSTOMER-LINKS',
        debug: true,
        timeouts: {
            save: 30000,
            create: 20000,
            update: 15000
        },
        retries: {
            max: 3,
            delay: 1000
        },
        validation: {
            strictCPF: true,
            requireAllFields: false,
            allowEmptyEmail: true
        },
        ui: {
            showProgress: true,
            autoClose: false,
            soundNotification: false
        },
        features: {
            autoSave: true,
            preventDuplicates: true,
            validateBeforeProcess: true,
            preserveFormData: true,
            updateStatusAfterEnrollment: true,
            saveLinksToCustomer: true  // Nova funcionalidade
        }
    };
    
    // ===== UTILITÁRIOS =====
    var Utils = {
        log: function(message, data) {
            if (CONFIG.debug) {
                console.log('[LMPreCad2] ' + message, data || '');
            }
        },
        
        error: function(message, error) {
            console.error('[LMPreCad2] ❌ ' + message, error);
        },
        
        sleep: function(ms) {
            return new Promise(function(resolve) {
                setTimeout(resolve, ms);
            });
        },
        
        retry: function(operation, maxRetries) {
            maxRetries = maxRetries || CONFIG.retries.max;
            var self = this;
            
            function attemptOperation(attempt) {
                return operation().catch(function(error) {
                    Utils.error('Tentativa ' + (attempt + 1) + '/' + maxRetries + ' falhou:', error);
                    if (attempt === maxRetries - 1) {
                        throw error;
                    }
                    return self.sleep(CONFIG.retries.delay * (attempt + 1)).then(function() {
                        return attemptOperation(attempt + 1);
                    });
                });
            }
            
            return attemptOperation(0);
        },
        
        cleanCPF: function(cpf) {
            return cpf ? cpf.replace(/\D/g, '') : '';
        },
        
        validateCPF: function(cpf) {
            var clean = Utils.cleanCPF(cpf);
            return clean.length === 11;
        },
        
        generateEmail: function(cpf) {
            return Utils.cleanCPF(cpf) + '@larmeimei.org';
        }
    };
    
    // ===== ATUALIZADOR DE CUSTOMER =====
    var CustomerUpdater = {
        updateCustomerWithLinks: function(customerId, links) {
            Utils.log('🔗 Atualizando Customer com links dos documentos criados');
            Utils.log('→ Customer ID: ' + customerId);
            Utils.log('→ Links para salvar:', links);
            
            return new Promise(function(resolve, reject) {
                if (!customerId) {
                    Utils.log('⚠️ ID do Customer não fornecido, pulando atualização');
                    resolve(null);
                    return;
                }
                
                // Primeiro, buscar o customer atual
                frappe.call({
                    method: 'frappe.client.get',
                    args: {
                        doctype: 'Customer',
                        name: customerId
                    },
                    callback: function(response) {
                        if (response && response.message) {
                            var customer = response.message;
                            var updated = false;
                            
                            Utils.log('📋 Customer atual encontrado:', customer.name);
                            
                            // Atualizar campos de links se existirem
                            if (links.student && customer.hasOwnProperty('link_st')) {
                                customer.link_st = links.student;
                                updated = true;
                                Utils.log('✅ link_st será atualizado: ' + links.student);
                            }
                            
                            if (links.gestante && customer.hasOwnProperty('link_ge')) {
                                customer.link_ge = links.gestante;
                                updated = true;
                                Utils.log('✅ link_ge será atualizado: ' + links.gestante);
                            }
                            
                            if (links.crianca && customer.hasOwnProperty('link_cr')) {
                                customer.link_cr = links.crianca;
                                updated = true;
                                Utils.log('✅ link_cr será atualizado: ' + links.crianca);
                            }
                            
                            // Verificar campos customizados alternativos
                            if (links.student && customer.hasOwnProperty('custom_link_st')) {
                                customer.custom_link_st = links.student;
                                updated = true;
                                Utils.log('✅ custom_link_st será atualizado: ' + links.student);
                            }
                            
                            if (links.gestante && customer.hasOwnProperty('custom_link_ge')) {
                                customer.custom_link_ge = links.gestante;
                                updated = true;
                                Utils.log('✅ custom_link_ge será atualizado: ' + links.gestante);
                            }
                            
                            if (links.crianca && customer.hasOwnProperty('custom_link_cr')) {
                                customer.custom_link_cr = links.crianca;
                                updated = true;
                                Utils.log('✅ custom_link_cr será atualizado: ' + links.crianca);
                            }
                            
                            if (!updated) {
                                Utils.log('⚠️ Nenhum campo de link encontrado no Customer para atualizar');
                                Utils.log('→ Campos disponíveis:', Object.keys(customer));
                                resolve(customer);
                                return;
                            }
                            
                            // Salvar as atualizações
                            frappe.call({
                                method: 'frappe.client.save',
                                args: { doc: customer },
                                freeze: true,
                                freeze_message: "🔗 Salvando links no cliente...",
                                callback: function(saveResponse) {
                                    if (saveResponse && saveResponse.message) {
                                        Utils.log('✅ Customer atualizado com links: ' + saveResponse.message.name);
                                        
                                        frappe.show_alert({
                                            message: '🔗 Links salvos no cliente com sucesso!',
                                            indicator: 'green'
                                        }, 5);
                                        
                                        resolve(saveResponse.message);
                                    } else {
                                        Utils.error('Resposta inválida ao atualizar Customer com links');
                                        reject(new Error('Falha ao salvar links no Customer'));
                                    }
                                },
                                error: function(error) {
                                    Utils.error('Erro ao salvar links no Customer:', error);
                                    reject(error);
                                }
                            });
                        } else {
                            Utils.error('Customer não encontrado para atualização de links: ' + customerId);
                            reject(new Error('Customer não encontrado'));
                        }
                    },
                    error: function(error) {
                        Utils.error('Erro ao buscar Customer para atualização:', error);
                        reject(error);
                    }
                });
            });
        },
        
        checkCustomerFields: function(customerId) {
            Utils.log('🔍 Verificando campos disponíveis no Customer');
            
            return new Promise(function(resolve) {
                frappe.call({
                    method: 'frappe.client.get',
                    args: {
                        doctype: 'Customer',
                        name: customerId
                    },
                    callback: function(response) {
                        if (response && response.message) {
                            var customer = response.message;
                            var availableFields = Object.keys(customer);
                            
                            var linkFields = {
                                hasLinkSt: availableFields.includes('link_st') || availableFields.includes('custom_link_st'),
                                hasLinkGe: availableFields.includes('link_ge') || availableFields.includes('custom_link_ge'),
                                hasLinkCr: availableFields.includes('link_cr') || availableFields.includes('custom_link_cr'),
                                allFields: availableFields.filter(function(field) {
                                    return field.includes('link_') || field.includes('_link');
                                })
                            };
                            
                            Utils.log('📋 Campos de link disponíveis no Customer:', linkFields);
                            resolve(linkFields);
                        } else {
                            resolve({ hasLinkSt: false, hasLinkGe: false, hasLinkCr: false, allFields: [] });
                        }
                    },
                    error: function() {
                        resolve({ hasLinkSt: false, hasLinkGe: false, hasLinkCr: false, allFields: [] });
                    }
                });
            });
        }
    };
    
    // ===== STATUS UPDATER =====
    var StatusUpdater = {
        updatePreCad2StatusToMatriculado: function(frm, studentId, enrollmentData) {
            Utils.log('🔄 Atualizando status do LM PreCad2 atual para 5.Matriculado');
            
            return new Promise(function(resolve) {
                if (!frm || !frm.doc || frm.doc.__islocal) {
                    Utils.log('⚠️ Formulário não salvo ainda, não é possível atualizar status');
                    resolve(false);
                    return;
                }
                
                try {
                    // Atualizar o status do formulário atual
                    frm.set_value('status', '5.Matriculado');
                    
                    // Adicionar informações do enrollment se houver campos apropriados
                    if (enrollmentData) {
                        Utils.log('📝 Adicionando informações do enrollment ao formulário');
                        
                        // Verificar se existem campos customizados para armazenar dados do enrollment
                        if (frm.fields_dict.custom_program_enrollment) {
                            frm.set_value('custom_program_enrollment', enrollmentData.name);
                        }
                        if (frm.fields_dict.custom_enrollment_date) {
                            frm.set_value('custom_enrollment_date', enrollmentData.enrollment_date);
                        }
                        if (frm.fields_dict.custom_program) {
                            frm.set_value('custom_program', enrollmentData.program);
                        }
                        
                        Utils.log('✅ Campos de enrollment preenchidos (se existirem)');
                    }
                    
                    // Tentar salvar automaticamente se a configuração permitir
                    if (CONFIG.features.autoSave && !frm._updating_status) {
                        frm._updating_status = true;
                        
                        Utils.log('💾 Salvando automaticamente o status atualizado');
                        
                        frm.save().then(function() {
                            frm._updating_status = false;
                            Utils.log('✅ Status 5.Matriculado salvo automaticamente');
                            
                            frappe.show_alert({
                                message: '📚 Status atualizado para "5.Matriculado"',
                                indicator: 'green'
                            }, 5);
                            
                            resolve(true);
                        }).catch(function(error) {
                            frm._updating_status = false;
                            Utils.error('Erro ao salvar status automaticamente:', error);
                            
                            frappe.show_alert({
                                message: '⚠️ Status atualizado. Clique em "Salvar" para persistir.',
                                indicator: 'orange'
                            }, 8);
                            
                            resolve(false);
                        });
                    } else {
                        Utils.log('✅ Status atualizado para 5.Matriculado (aguardando salvamento manual)');
                        
                        frappe.show_alert({
                            message: '📚 Status atualizado para "5.Matriculado". Clique em "Salvar".',
                            indicator: 'blue'
                        }, 8);
                        
                        resolve(true);
                    }
                    
                } catch (error) {
                    Utils.error('Erro ao atualizar status:', error);
                    resolve(false);
                }
            });
        },
        
        updateOtherPreCad2Records: function(studentId, enrollmentData) {
            Utils.log('🔍 Buscando outros registros de PreCad2 com o mesmo Student');
            
            return new Promise(function(resolve) {
                if (!studentId) {
                    resolve([]);
                    return;
                }
                
                frappe.call({
                    method: 'frappe.client.get_list',
                    args: {
                        doctype: 'LM PreCad2',
                        fields: ['name', 'link_st', 'status', 'full_name'],
                        filters: {
                            'link_st': studentId,
                            'status': ['!=', '5.Matriculado'] // Só atualizar os que não estão matriculados
                        },
                        limit: 20
                    },
                    callback: function(response) {
                        if (response && response.message && response.message.length > 0) {
                            Utils.log('✅ Encontrados ' + response.message.length + ' outros registros para atualizar');
                            
                            var updatePromises = response.message.map(function(record) {
                                return StatusUpdater.updateSinglePreCad2Status(record, enrollmentData);
                            });
                            
                            Promise.all(updatePromises).then(function(results) {
                                var successful = results.filter(function(r) { return r; }).length;
                                Utils.log('✅ Atualizados ' + successful + ' de ' + results.length + ' registros');
                                
                                if (successful > 0) {
                                    frappe.show_alert({
                                        message: '📚 ' + successful + ' registro(s) adicional(is) atualizado(s) para "5.Matriculado"',
                                        indicator: 'green'
                                    }, 6);
                                }
                                
                                resolve(results);
                            });
                        } else {
                            Utils.log('ℹ️ Nenhum outro registro de PreCad2 encontrado para atualizar');
                            resolve([]);
                        }
                    },
                    error: function(error) {
                        Utils.error('Erro ao buscar outros registros de PreCad2:', error);
                        resolve([]);
                    }
                });
            });
        },
        
        updateSinglePreCad2Status: function(record, enrollmentData) {
            Utils.log('📝 Atualizando registro: ' + record.name);
            
            return new Promise(function(resolve) {
                frappe.call({
                    method: 'frappe.client.get',
                    args: {
                        doctype: 'LM PreCad2',
                        name: record.name
                    },
                    callback: function(getResponse) {
                        if (getResponse && getResponse.message) {
                            var doc = getResponse.message;
                            doc.status = '5.Matriculado';
                            
                            // Adicionar info do enrollment se houver campos apropriados
                            if (enrollmentData) {
                                if (doc.hasOwnProperty('custom_program_enrollment')) {
                                    doc.custom_program_enrollment = enrollmentData.name;
                                }
                                if (doc.hasOwnProperty('custom_enrollment_date')) {
                                    doc.custom_enrollment_date = enrollmentData.enrollment_date;
                                }
                                if (doc.hasOwnProperty('custom_program')) {
                                    doc.custom_program = enrollmentData.program;
                                }
                            }
                            
                            frappe.call({
                                method: 'frappe.client.save',
                                args: { doc: doc },
                                callback: function(saveResponse) {
                                    if (saveResponse && saveResponse.message) {
                                        Utils.log('✅ Registro atualizado: ' + record.name);
                                        resolve(true);
                                    } else {
                                        Utils.error('Erro ao salvar registro: ' + record.name);
                                        resolve(false);
                                    }
                                },
                                error: function(error) {
                                    Utils.error('Erro ao salvar registro ' + record.name + ':', error);
                                    resolve(false);
                                }
                            });
                        } else {
                            Utils.error('Registro não encontrado: ' + record.name);
                            resolve(false);
                        }
                    },
                    error: function(error) {
                        Utils.error('Erro ao buscar registro ' + record.name + ':', error);
                        resolve(false);
                    }
                });
            });
        }
    };
    
    // ===== VALIDADOR =====
    var Validator = {
        validateRequired: function(frm) {
            Utils.log('🔍 Iniciando validação de campos obrigatórios');
            
            var errors = [];
            
            if (!frm.doc.full_name || frm.doc.full_name.trim() === '') {
                errors.push('Nome completo é obrigatório');
            }
            
            if (!frm.doc.cpf || frm.doc.cpf.trim() === '') {
                errors.push('CPF é obrigatório');
            } else if (!Utils.validateCPF(frm.doc.cpf)) {
                errors.push('CPF deve ter 11 dígitos válidos');
            }
            
            var modes = frm.doc.is_mt || frm.doc.is_sf || frm.doc.is_ge || frm.doc.is_ep || frm.doc.is_cb;
            if (!modes) {
                errors.push('Selecione pelo menos um modo de cadastramento');
            }
            
            if (errors.length > 0) {
                var message = errors.join('<br>');
                frappe.msgprint({
                    title: 'Campos Obrigatórios',
                    message: message,
                    indicator: 'red'
                });
                return false;
            }
            
            Utils.log('✅ Validação passou');
            return true;
        },
        
        validateCustomerData: function(customerData) {
            Utils.log('🔍 Validando customerData recebido');
            
            if (!customerData) {
                throw new Error('customerData não foi fornecido');
            }
            
            var requiredFields = [
                'customer_name', 
                'tax_id', 
                'data_de_nascimento',
                'cep',
                'celular',
                'email'
            ];
            
            var missingFields = [];
            
            for (var i = 0; i < requiredFields.length; i++) {
                var field = requiredFields[i];
                var value = customerData[field];
                if (!value || (typeof value === 'string' && value.trim() === '')) {
                    missingFields.push(field);
                }
            }
            
            if (missingFields.length > 0) {
                Utils.error('Campos obrigatórios faltando no customerData:', missingFields);
                throw new Error('CustomerData inválido - campos faltando: ' + missingFields.join(', '));
            }
            
            Utils.log('✅ CustomerData validado com sucesso');
            return true;
        }
    };
    
    // ===== PREPARADOR DE DADOS =====
    var DataPreparator = {
        prepare: function(frm, receivedData) {
            Utils.log('🔧 Verificando dados para processamento');
            
            var hasValidData = false;
            var customerDataFromCaller = null;
            
            try {
                if (receivedData && 
                    typeof receivedData === 'object' && 
                    receivedData !== null &&
                    receivedData.customerData &&
                    typeof receivedData.customerData === 'object') {
                    hasValidData = true;
                    customerDataFromCaller = receivedData.customerData;
                }
            } catch (error) {
                Utils.log('⚠️ Erro ao verificar dados recebidos: ' + error.message);
                hasValidData = false;
            }
            
            Utils.log('🔍 Status dos dados recebidos:', {
                temDados: !!receivedData,
                dadosValidos: hasValidData,
                temCustomerData: !!customerDataFromCaller
            });
            
            if (hasValidData && customerDataFromCaller) {
                Utils.log('📦 Usando dados já preparados pelo código chamador');
                Utils.log('→ CustomerData recebido:', customerDataFromCaller);
                
                try {
                    Validator.validateCustomerData(customerDataFromCaller);
                    
                    var preparedData = {
                        customerData: customerDataFromCaller,
                        cpfLimpo: receivedData.cpfLimpo || Utils.cleanCPF(customerDataFromCaller.tax_id),
                        shouldCreateStudent: receivedData.shouldCreateStudent !== undefined 
                            ? receivedData.shouldCreateStudent 
                            : (frm.doc.is_mt || frm.doc.is_sf || frm.doc.is_ge),
                        shouldCreateGestante: receivedData.shouldCreateGestante !== undefined 
                            ? receivedData.shouldCreateGestante 
                            : frm.doc.is_ge,
                        shouldCreateCrianca: receivedData.shouldCreateCrianca !== undefined 
                            ? receivedData.shouldCreateCrianca 
                            : frm.doc.is_cb, // Assumindo que is_cb indica criança
                        originalData: receivedData.originalData || frm.doc
                    };
                    
                    Utils.log('✅ Dados do chamador validados e preparados:', preparedData);
                    return preparedData;
                    
                } catch (validationError) {
                    Utils.error('❌ Falha na validação dos dados recebidos:', validationError);
                    Utils.log('🔄 Prosseguindo com preparação do formulário como fallback');
                }
            }
            
            Utils.log('🔧 Preparando dados do formulário (fallback)');
            
            try {
                var cpfLimpo = Utils.cleanCPF(frm.doc.cpf);
                var dataNascimento = frm.doc.date_of_birth || '1990-01-01';
                var cep = frm.doc.cep || '00000-000';
                var celular = frm.doc.cel || '(11) 99999-9999';
                var email = frm.doc.email_id || Utils.generateEmail(cpfLimpo);
                
                var customerData = {
                    doctype: 'Customer',
                    customer_name: frm.doc.full_name,
                    tax_id: cpfLimpo,
                    customer_type: 'Individual',
                    data_de_nascimento: dataNascimento,
                    cep: cep,
                    celular: celular,
                    email: email
                };
                
                if (frm.doc.gender) customerData.custom_gender = frm.doc.gender;
                if (frm.doc.idade) customerData.custom_idade = frm.doc.idade;
                if (frm.doc.numero) customerData.custom_numero = frm.doc.numero;
                
                if (frm.doc.is_mt) customerData.custom_is_mt = 1;
                if (frm.doc.is_sf) customerData.custom_is_sf = 1;
                if (frm.doc.is_ge) customerData.custom_is_ge = 1;
                if (frm.doc.is_ep) customerData.custom_is_ep = 1;
                if (frm.doc.is_cb) customerData.custom_is_cb = 1;
                
                var preparedData = {
                    customerData: customerData,
                    cpfLimpo: cpfLimpo,
                    shouldCreateStudent: frm.doc.is_mt || frm.doc.is_sf || frm.doc.is_ge,
                    shouldCreateGestante: frm.doc.is_ge,
                    shouldCreateCrianca: frm.doc.is_cb,
                    originalData: frm.doc
                };
                
                Utils.log('✅ Dados preparados (fallback):', preparedData);
                return preparedData;
                
            } catch (fallbackError) {
                Utils.error('❌ Erro na preparação fallback:', fallbackError);
                throw new Error('Falha ao preparar dados: ' + fallbackError.message);
            }
        }
    };
    
    // ===== MANIPULADOR DE DOCUMENTOS =====
    var DocumentHandler = {
        saveDocument: function(frm) {
            Utils.log('💾 Salvando documento');
            
            return new Promise(function(resolve, reject) {
                if (frm.doc.__islocal) {
                    Utils.log('→ Documento novo - primeira gravação');
                    
                    try {
                        frm.save().then(function() {
                            Utils.log('✅ Documento salvo: ' + frm.doc.name);
                            resolve(frm.doc);
                        }).catch(function(error) {
                            Utils.error('Erro no salvamento:', error);
                            frm.save();
                            setTimeout(function() {
                                if (!frm.doc.__islocal) {
                                    Utils.log('✅ Documento salvo (fallback): ' + frm.doc.name);
                                    resolve(frm.doc);
                                } else {
                                    reject(new Error('Falha no salvamento do documento'));
                                }
                            }, 1000);
                        });
                    } catch (saveError) {
                        Utils.error('Erro ao tentar salvar:', saveError);
                        frm.save();
                        setTimeout(function() {
                            if (!frm.doc.__islocal) {
                                Utils.log('✅ Documento salvo (último recurso): ' + frm.doc.name);
                                resolve(frm.doc);
                            } else {
                                reject(new Error('Falha total no salvamento'));
                            }
                        }, 1500);
                    }
                } else {
                    Utils.log('→ Documento já existe: ' + frm.doc.name);
                    resolve(frm.doc);
                }
            });
        }
    };
    
    // ===== PROCESSADORES DE ENTIDADES =====
    var EntityProcessors = {
        processCustomer: function(customerData, existingId) {
            Utils.log('👤 Processando Customer');
            Utils.log('📋 CustomerData que será enviado:', customerData);
            
            return new Promise(function(resolve, reject) {
                if (existingId && existingId.trim() !== '') {
                    Utils.log('🔄 Atualizando Customer existente: ' + existingId);
                    
                    frappe.call({
                        method: 'frappe.client.get',
                        args: { doctype: 'Customer', name: existingId },
                        freeze: true,
                        freeze_message: "🔄 Carregando cliente...",
                        callback: function(response) {
                            if (response && response.message) {
                                var customer = response.message;
                                
                                var fields = Object.keys(customerData);
                                for (var i = 0; i < fields.length; i++) {
                                    var field = fields[i];
                                    if (field !== 'doctype') {
                                        customer[field] = customerData[field];
                                    }
                                }
                                
                                Utils.log('📋 Customer que será atualizado:', customer);
                                
                                frappe.call({
                                    method: 'frappe.client.save',
                                    args: { doc: customer },
                                    freeze: true,
                                    freeze_message: "💾 Atualizando cliente...",
                                    callback: function(saveResponse) {
                                        if (saveResponse && saveResponse.message) {
                                            Utils.log('✅ Customer atualizado: ' + saveResponse.message.name);
                                            resolve(saveResponse.message);
                                        } else {
                                            reject(new Error('Resposta inválida ao atualizar Customer'));
                                        }
                                    },
                                    error: function(error) {
                                        Utils.error('Erro ao atualizar Customer:', error);
                                        reject(error);
                                    }
                                });
                            } else {
                                reject(new Error('Customer não encontrado para atualização'));
                            }
                        },
                        error: function(error) {
                            Utils.error('Erro ao buscar Customer existente:', error);
                            reject(error);
                        }
                    });
                } else {
                    Utils.log('🆕 Criando novo Customer');
                    Utils.log('📋 CustomerData para criação:', customerData);
                    
                    frappe.call({
                        method: 'frappe.client.insert',
                        args: { doc: customerData },
                        freeze: true,
                        freeze_message: "🆕 Criando novo cliente...",
                        callback: function(response) {
                            if (response && response.message) {
                                Utils.log('✅ Customer criado: ' + response.message.name);
                                resolve(response.message);
                            } else {
                                reject(new Error('Resposta inválida ao criar Customer'));
                            }
                        },
                        error: function(error) {
                            Utils.error('Erro ao criar Customer:', error);
                            reject(error);
                        }
                    });
                }
            });
        },
        
        processStudent: function(customerResponse, cpfLimpo, formData) {
            Utils.log('🎓 Processando Student');
            
            return new Promise(function(resolve, reject) {
                frappe.call({
                    method: 'frappe.client.get_list',
                    args: {
                        doctype: 'Student',
                        fields: ['name', 'title', 'cpf', 'assistido'],
                        filters: { 'cpf': cpfLimpo },
                        limit: 1
                    },
                    callback: function(searchResponse) {
                        if (searchResponse && searchResponse.message && searchResponse.message.length > 0) {
                            var existingStudent = searchResponse.message[0];
                            Utils.log('🔄 Atualizando Student existente: ' + existingStudent.name);
                            
                            EntityProcessors.updateStudent(existingStudent.name, customerResponse, formData)
                                .then(resolve)
                                .catch(reject);
                        } else {
                            Utils.log('🆕 Criando novo Student');
                            
                            EntityProcessors.createStudent(customerResponse, cpfLimpo, formData)
                                .then(resolve)
                                .catch(reject);
                        }
                    },
                    error: reject
                });
            });
        },
        
        updateStudent: function(studentId, customerResponse, formData) {
            return new Promise(function(resolve, reject) {
                frappe.call({
                    method: 'frappe.client.get',
                    args: { doctype: 'Student', name: studentId },
                    callback: function(getResponse) {
                        if (getResponse && getResponse.message) {
                            var student = getResponse.message;
                            
                            var sourceData = formData.full_name ? formData : {
                                full_name: customerResponse.customer_name,
                                date_of_birth: customerResponse.data_de_nascimento,
                                cel: customerResponse.celular,
                                email_id: customerResponse.email,
                                gender: customerResponse.custom_gender
                            };
                            
                            var nomeCompleto = sourceData.full_name;
                            var partes = nomeCompleto.trim().split(/\s+/);
                            
                            student.first_name = partes[0] || 'Estudante';
                            if (partes.length > 1) student.last_name = partes.slice(1).join(' ');
                            student.title = nomeCompleto;
                            student.assistido = customerResponse.name;
                            
                            if (sourceData.date_of_birth) student.date_of_birth = sourceData.date_of_birth;
                            if (sourceData.cel) student.mobile_number = sourceData.cel.replace(/\D/g, '');
                            if (sourceData.email_id) student.student_email_id = sourceData.email_id;
                            if (sourceData.gender) student.gender = sourceData.gender;
                            
                            frappe.call({
                                method: 'frappe.client.save',
                                args: { doc: student },
                                freeze: true,
                                freeze_message: "💾 Atualizando estudante...",
                                callback: function(updateResponse) {
                                    if (updateResponse && updateResponse.message) {
                                        Utils.log('✅ Student atualizado: ' + updateResponse.message.name);
                                        resolve(updateResponse.message);
                                    } else {
                                        reject(new Error('Erro ao atualizar Student'));
                                    }
                                },
                                error: reject
                            });
                        } else {
                            reject(new Error('Student não encontrado para atualização'));
                        }
                    },
                    error: reject
                });
            });
        },
        
        createStudent: function(customerResponse, cpfLimpo, formData) {
            return new Promise(function(resolve, reject) {
                var sourceData = formData.full_name ? formData : {
                    full_name: customerResponse.customer_name,
                    date_of_birth: customerResponse.data_de_nascimento,
                    cel: customerResponse.celular,
                    email_id: customerResponse.email,
                    gender: customerResponse.custom_gender
                };
                
                var nomeCompleto = sourceData.full_name;
                var partes = nomeCompleto.trim().split(/\s+/);
                
                var studentData = {
                    doctype: 'Student',
                    first_name: partes[0] || 'Estudante',
                    title: nomeCompleto,
                    assistido: customerResponse.name,
                    cpf: cpfLimpo
                };
                
                if (partes.length > 1)          studentData.last_name = partes.slice(1).join(' ');
                if (sourceData.date_of_birth)   studentData.date_of_birth = sourceData.date_of_birth;
                if (sourceData.cel)             studentData.mobile_number = sourceData.cel.replace(/\D/g, '');
                if (sourceData.email_id)        studentData.student_email_id = sourceData.email_id;
                if (sourceData.gender)          studentData.gender = sourceData.gender;
                
                frappe.call({
                    method: 'frappe.client.insert',
                    args: { doc: studentData },
                    freeze: true,
                    freeze_message: "🆕 Criando estudante...",
                    callback: function(createResponse) {
                        if (createResponse && createResponse.message) {
                            Utils.log('✅ Student criado: ' + createResponse.message.name);
                            resolve(createResponse.message);
                        } else {
                            reject(new Error('Erro ao criar Student'));
                        }
                    },
                    error: reject
                });
            });
        },
        
        processGestante: function(customerResponse, formData) {
            Utils.log('🤰 Processando Gestante');
            
            return new Promise(function(resolve, reject) {
                var sourceData = formData.full_name ? formData : {
                    full_name: customerResponse.customer_name,
                    cpf: customerResponse.tax_id,
                    date_of_birth: customerResponse.data_de_nascimento,
                    cel: customerResponse.celular,
                    email_id: customerResponse.email,
                    idade: customerResponse.custom_idade,
                    link_ge_student_group: formData.link_ge_student_group
                };
                
                var gestanteData = {
                    doctype: 'LM Gestante-Ficha',
                    assistido: sourceData.full_name,
                    turma: sourceData.link_ge_student_group || '',
                    customer_link: customerResponse.name
                };
                
                if (sourceData.cpf)             gestanteData.cpf = sourceData.cpf;
                if (sourceData.date_of_birth)   gestanteData.data_nascimento = sourceData.date_of_birth;
                if (sourceData.cel)             gestanteData.telefone = sourceData.cel;
                if (sourceData.email_id)        gestanteData.email = sourceData.email_id;
                if (sourceData.idade)           gestanteData.idade = sourceData.idade;
                
                frappe.call({
                    method: 'frappe.client.insert',
                    args: { doc: gestanteData },
                    freeze: true,
                    freeze_message: "🤰 Criando ficha de gestante...",
                    callback: function(response) {
                        if (response && response.message) {
                            Utils.log('✅ Gestante criada: ' + response.message.name);
                            resolve(response.message);
                        } else {
                            reject(new Error('Erro ao criar Ficha Gestante'));
                        }
                    },
                    error: reject
                });
            });
        },
        
        processCrianca: function(customerResponse, formData) {
            Utils.log('🧒 Processando Criança');
            
            return new Promise(function(resolve, reject) {
                var sourceData = formData.full_name ? formData : {
                    full_name: customerResponse.customer_name,
                    cpf: customerResponse.tax_id,
                    date_of_birth: customerResponse.data_de_nascimento,
                    cel: customerResponse.celular,
                    email_id: customerResponse.email,
                    idade: customerResponse.custom_idade
                };
                
                var criancaData = {
                    doctype: 'LM Crianca-Ficha',
                    assistido: sourceData.full_name,
                    customer_link: customerResponse.name
                };
                
                if (sourceData.cpf)             criancaData.cpf = sourceData.cpf;
                if (sourceData.date_of_birth)   criancaData.data_nascimento = sourceData.date_of_birth;
                if (sourceData.cel)             criancaData.telefone = sourceData.cel;
                if (sourceData.email_id)        criancaData.email = sourceData.email_id;
                if (sourceData.idade)           criancaData.idade = sourceData.idade;
                
                frappe.call({
                    method: 'frappe.client.insert',
                    args: { doc: criancaData },
                    freeze: true,
                    freeze_message: "🧒 Criando ficha de criança...",
                    callback: function(response) {
                        if (response && response.message) {
                            Utils.log('✅ Criança criada: ' + response.message.name);
                            resolve(response.message);
                        } else {
                            reject(new Error('Erro ao criar Ficha Criança'));
                        }
                    },
                    error: reject
                });
            });
        }
    };
    
    // ===== INTERFACE DE USUÁRIO =====
    var UI = {
        showSuccess: function(frm, processamento) {
            Utils.log('🎯 === UI.showSuccess CHAMADO ===');
            Utils.log('📋 Dados recebidos para sucesso:', processamento);
            
            frappe.show_alert({ 
                message: '✅ Processamento concluído! Clique em Salvar para persistir os links.', 
                indicator: 'green' 
            }, 12);
            Utils.log('✅ Alert básico garantido exibido');
            
            try {
                var tipoCadastro = 'Cadastro';
                if (frm.doc.is_ge) tipoCadastro = 'Gestantes';
                else if (frm.doc.is_mt) tipoCadastro = 'Mundo do Trabalho';
                else if (frm.doc.is_sf) tipoCadastro = 'Sócio-Familiar';
                else if (frm.doc.is_ep) tipoCadastro = 'Empregabilidade';
                else if (frm.doc.is_cb) tipoCadastro = 'Cesta Básica';
                
                frappe.show_alert({ 
                    message: '🎯 ' + tipoCadastro + ' processado! Links preenchidos e salvos no cliente.', 
                    indicator: 'green' 
                }, 10);
                Utils.log('✅ Alert específico exibido para: ' + tipoCadastro);
                
                setTimeout(function() {
                    try {
                        var mensagem = '<div style="font-family: Arial, sans-serif; line-height: 1.5;">';
                        
                        mensagem += '<div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">';
                        mensagem += '<h3 style="margin: 0; color: #2d5a2d;">🎯 Processamento Concluído com Sucesso!</h3>';
                        mensagem += '<p style="margin: 5px 0 0 0; color: #555;">Todos os documentos foram criados e os links foram preenchidos</p>';
                        if (processamento && processamento.customerUpdated) {
                            mensagem += '<p style="margin: 10px 0 0 0; color: #2e7d32; font-weight: bold;">🔗 Links salvos no Customer automaticamente</p>';
                        }
                        if (processamento && processamento.statusUpdated) {
                            mensagem += '<p style="margin: 10px 0 0 0; color: #2e7d32; font-weight: bold;">📚 Status atualizado para "5.Matriculado"</p>';
                        }
                        mensagem += '<p style="margin: 10px 0 0 0; color: #d32f2f; font-weight: bold;">⚠️ IMPORTANTE: Clique no botão "Salvar" para persistir os links no banco de dados</p>';
                        mensagem += '</div>';
                        
                        if (processamento && processamento.customer) {
                            mensagem += '<div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 15px;">';
                            mensagem += '<h4 style="margin: 0 0 10px 0; color: #1565c0;">👤 Cliente</h4>';
                            mensagem += '<strong>Nome:</strong> ' + processamento.customer.customer_name + '<br>';
                            mensagem += '<strong>ID:</strong> ' + processamento.customer.name + '<br>';
                            mensagem += '<strong>Link preenchido:</strong> <span style="color: #2e7d32;">link_cst</span>';
                            if (processamento.customerUpdated) {
                                mensagem += '<br><strong>Links salvos no Customer:</strong> <span style="color: #2e7d32;">✅ Concluído</span>';
                            }
                            mensagem += '</div>';
                        }
                        
                        if (processamento && processamento.student) {
                            mensagem += '<div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin-bottom: 15px;">';
                            mensagem += '<h4 style="margin: 0 0 10px 0; color: #f57c00;">🎓 Estudante</h4>';
                            mensagem += '<strong>Nome:</strong> ' + processamento.student.title + '<br>';
                            mensagem += '<strong>ID:</strong> ' + processamento.student.name + '<br>';
                            mensagem += '<strong>Link preenchido:</strong> <span style="color: #2e7d32;">link_st</span>';
                            if (processamento.customerUpdated) {
                                mensagem += '<br><strong>Salvo no Customer:</strong> <span style="color: #2e7d32;">✅ link_st</span>';
                            }
                            mensagem += '</div>';
                        }
                        
                        if (processamento && processamento.gestante) {
                            mensagem += '<div style="background: #f3e5f5; padding: 15px; border-radius: 8px; margin-bottom: 15px;">';
                            mensagem += '<h4 style="margin: 0 0 10px 0; color: #7b1fa2;">🤰 Ficha de Gestante</h4>';
                            mensagem += '<strong>ID:</strong> ' + processamento.gestante.name + '<br>';
                            mensagem += '<strong>Link preenchido:</strong> <span style="color: #2e7d32;">link_ge</span>';
                            if (processamento.customerUpdated) {
                                mensagem += '<br><strong>Salvo no Customer:</strong> <span style="color: #2e7d32;">✅ link_ge</span>';
                            }
                            mensagem += '</div>';
                        }
                        
                        if (processamento && processamento.crianca) {
                            mensagem += '<div style="background: #e1f5fe; padding: 15px; border-radius: 8px; margin-bottom: 15px;">';
                            mensagem += '<h4 style="margin: 0 0 10px 0; color: #0277bd;">🧒 Ficha de Criança</h4>';
                            mensagem += '<strong>ID:</strong> ' + processamento.crianca.name + '<br>';
                            mensagem += '<strong>Link preenchido:</strong> <span style="color: #2e7d32;">link_cr</span>';
                            if (processamento.customerUpdated) {
                                mensagem += '<br><strong>Salvo no Customer:</strong> <span style="color: #2e7d32;">✅ link_cr</span>';
                            }
                            mensagem += '</div>';
                        }
                        
                        if (processamento && processamento.programEnrollment) {
                            mensagem += '<div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin-bottom: 15px;">';
                            mensagem += '<h4 style="margin: 0 0 10px 0; color: #2e7d32;">📚 Program Enrollment</h4>';
                            mensagem += '<strong>ID:</strong> ' + processamento.programEnrollment.name + '<br>';
                            mensagem += '<strong>Student:</strong> ' + (processamento.student ? processamento.student.title : 'N/A') + '<br>';
                            mensagem += '<strong>Status:</strong> <span style="color: #2e7d32;">Criado automaticamente</span>';
                            if (processamento.statusUpdated) {
                                mensagem += '<br><strong>Status PreCad2:</strong> <span style="color: #2e7d32;">Atualizado para "5.Matriculado"</span>';
                            }
                            mensagem += '</div>';
                        }
                        
                        mensagem += '<div style="background: #fff3e0; padding: 15px; border-radius: 8px; border-left: 4px solid #ff9800;">';
                        mensagem += '<h4 style="margin: 0 0 10px 0; color: #ef6c00;">📋 Próximos Passos</h4>';
                        mensagem += '<ol style="margin: 0; padding-left: 20px;">';
                        mensagem += '<li>Verifique se os campos de link estão preenchidos</li>';
                        if (processamento && processamento.customerUpdated) {
                            mensagem += '<li><strong>Links foram salvos automaticamente no Customer ✅</strong></li>';
                        }
                        if (processamento && processamento.statusUpdated) {
                            mensagem += '<li><strong>Status foi atualizado para "5.Matriculado"</strong></li>';
                        }
                        mensagem += '<li><strong>Clique no botão "Salvar"</strong> para persistir as informações no PreCad2</li>';
                        mensagem += '<li>Os registros criados estarão permanentemente vinculados</li>';
                        mensagem += '</ol>';
                        mensagem += '</div>';
                        
                        mensagem += '</div>';
                        
                        frappe.msgprint({
                            title: '🎯 Processamento Concluído - Links Salvos Automaticamente',
                            message: mensagem,
                            indicator: 'green'
                        });
                        Utils.log('✅ Mensagem detalhada exibida com sucesso');
                        
                    } catch (msgError) {
                        Utils.error('Erro na mensagem detalhada:', msgError);
                    }
                }, 1000);
                
            } catch (error) {
                Utils.error('Erro geral ao exibir sucesso:', error);
            }
            
            Utils.log('🎯 === UI.showSuccess CONCLUÍDO ===');
        },
        
        showError: function(frm, mensagem) {
            Utils.error('Exibindo erro: ' + mensagem);
            
            frappe.show_alert({ 
                message: '❌ ' + mensagem, 
                indicator: 'red' 
            }, 10);
            
            frappe.msgprint({
                title: '❌ Erro no Processamento',
                message: '<div style="background: #ffebee; padding: 15px; border-radius: 8px;">' +
                        '<strong style="color: #c62828;">Erro encontrado:</strong><br>' + 
                        '<code>' + mensagem + '</code><br><br>' +
                        '<strong>Próximos passos:</strong><br>' +
                        '1. Verifique os dados inseridos<br>' +
                        '2. Tente novamente<br>' +
                        '3. Se o erro persistir, contate o suporte<br><br>' +
                        '<strong>Observação:</strong> Os dados digitados foram preservados no formulário.' +
                        '</div>',
                indicator: 'red'
            });
        }
    };
    
    // ===== PROCESSADOR PRINCIPAL =====
    var MainProcessor = {
        process: function(frm, externalData) {
            Utils.log('🚀 === INICIANDO PROCESSAMENTO AUTÔNOMO ===');
            Utils.log('→ Timestamp: ' + new Date().toISOString());
            Utils.log('→ Dados externos recebidos: ' + !!externalData);
            
            if (externalData) {
                Utils.log('📦 Preview dos dados externos:', {
                    tipo: typeof externalData,
                    keys: externalData ? Object.keys(externalData) : null
                });
            }
            
            return new Promise(function(resolve, reject) {
                frm._creating_documents = true;
                
                try {
                    // ETAPA 1: Validação
                    if (!externalData && !Validator.validateRequired(frm)) {
                        throw new Error('Validação de campos obrigatórios falhou');
                    }
                    
                    // ETAPA 2: Preparar dados
                    var processedData;
                    try {
                        processedData = DataPreparator.prepare(frm, externalData);
                    } catch (prepareError) {
                        Utils.error('Erro na preparação de dados:', prepareError);
                        throw new Error('Falha na preparação de dados: ' + prepareError.message);
                    }
                    
                    Utils.log('✅ Dados preparados com sucesso:', processedData);
                    
                    // ETAPA 3: Processamento das entidades
                    var processamento = {
                        customer: null,
                        student: null,
                        gestante: null,
                        crianca: null,
                        programEnrollment: null,
                        statusUpdated: false,
                        customerUpdated: false
                    };
                    
                    Utils.log('🚀 Iniciando processamento das entidades...');
                    
                    // ETAPA 4: Processar Customer
                    Utils.log('🚀 Processando Customer...');
                    EntityProcessors.processCustomer(
                        processedData.customerData, 
                        frm.doc.link_cst
                    )
                    .then(function(customer) {
                        Utils.log('✅ Customer processado: ' + customer.name);
                        processamento.customer = customer;
                        frm.set_value('link_cst', customer.name);
                        
                        // ETAPA 5: Processar Student (se necessário)
                        if (processedData.shouldCreateStudent) {
                            Utils.log('🚀 Processando Student...');
                            return EntityProcessors.processStudent(
                                customer,
                                processedData.cpfLimpo,
                                processedData.originalData || frm.doc
                            );
                        } else {
                            Utils.log('⏭️ Student não necessário');
                            return null;
                        }
                    })
                    .then(function(student) {
                        if (student) {
                            Utils.log('✅ Student processado: ' + student.name);
                            processamento.student = student;
                            frm.set_value('link_st', student.name);
                        }
                        
                        // ETAPA 6: Processar Gestante (se necessário)
                        if (processedData.shouldCreateGestante) {
                            Utils.log('🚀 Processando Gestante...');
                            return EntityProcessors.processGestante(
                                processamento.customer,
                                processedData.originalData || frm.doc
                            );
                        } else {
                            Utils.log('⏭️ Gestante não necessária');
                            return null;
                        }
                    })
                    .then(function(gestante) {
                        if (gestante) {
                            Utils.log('✅ Gestante processada: ' + gestante.name);
                            processamento.gestante = gestante;
                            frm.set_value('link_ge', gestante.name);
                        }
                        
                        // ETAPA 7: Processar Criança (se necessário)
                        if (processedData.shouldCreateCrianca) {
                            Utils.log('🚀 Processando Criança...');
                            return EntityProcessors.processCrianca(
                                processamento.customer,
                                processedData.originalData || frm.doc
                            );
                        } else {
                            Utils.log('⏭️ Criança não necessária');
                            return null;
                        }
                    })
                    .then(function(crianca) {
                        if (crianca) {
                            Utils.log('✅ Criança processada: ' + crianca.name);
                            processamento.crianca = crianca;
                            frm.set_value('link_cr', crianca.name);
                        }
                        
                        // ETAPA 8: Atualizar Customer com links dos documentos criados
                        if (CONFIG.features.saveLinksToCustomer && processamento.customer) {
                            Utils.log('🔗 Salvando links no Customer...');
                            
                            var linksToSave = {};
                            if (processamento.student)  linksToSave.student = processamento.student.name;
                            if (processamento.gestante) linksToSave.gestante = processamento.gestante.name;
                            if (processamento.crianca)  linksToSave.crianca = processamento.crianca.name;
                            
                            return CustomerUpdater.updateCustomerWithLinks(processamento.customer.name, linksToSave)
                                .then(function(updatedCustomer) {
                                    if (updatedCustomer) {
                                        processamento.customer = updatedCustomer;
                                        processamento.customerUpdated = true;
                                        Utils.log('✅ Customer atualizado com links');
                                    }
                                    return processamento;
                                })
                                .catch(function(linkError) {
                                    Utils.error('Erro ao salvar links no Customer (continuando):', linkError);
                                    return processamento;
                                });
                        } else {
                            Utils.log('⏭️ Atualização de links no Customer desabilitada ou Customer não disponível');
                            return processamento;
                        }
                    })
                    .then(function(processamentoComLinks) {
                        // ETAPA 9: Criar Program Enrollment (se aplicável)
                        if (processamentoComLinks.student && processamentoComLinks.gestante && 
                            frm.doc.link_ge_student_group && 
                            typeof window.LMProgramEnrollmentProcessor !== 'undefined') {
                            
                            Utils.log('🎓 Criando Program Enrollment para Gestante...');
                            
                            var studentId = processamentoComLinks.student.name;
                            var studentGroupId = frm.doc.link_ge_student_group;
                            var gestanteData = {
                                data_nascimento: processamentoComLinks.gestante.data_nascimento,
                                telefone: processamentoComLinks.gestante.telefone,
                                email: processamentoComLinks.gestante.email,
                                idade: processamentoComLinks.gestante.idade
                            };
                            
                            return window.LMProgramEnrollmentProcessor.criar(studentId, studentGroupId, gestanteData)
                                .then(function(enrollmentResult) {
                                    if (enrollmentResult) {
                                        processamentoComLinks.programEnrollment = enrollmentResult.enrollment;
                                        
                                        frappe.show_alert({
                                            message: '📚 Program Enrollment criado: ' + enrollmentResult.enrollment.name,
                                            indicator: 'green'
                                        }, 5);
                                    }
                                    return processamentoComLinks;
                                });
                        } else {
                            if (!processamentoComLinks.student) {
                                Utils.log('⚠️ Student não disponível, pulando Program Enrollment');
                            } else if (!processamentoComLinks.gestante) {
                                Utils.log('⚠️ Gestante não disponível, pulando Program Enrollment');
                            } else if (!frm.doc.link_ge_student_group) {
                                Utils.log('⚠️ Student Group não informado, pulando Program Enrollment');
                            } else {
                                Utils.log('⚠️ LMProgramEnrollmentProcessor não carregado, pulando Program Enrollment');
                            }
                            return processamentoComLinks;
                        }
                    })
                    .then(function(processamentoComEnrollment) {
                        // ETAPA 10: Atualizar status para 5.Matriculado (se aplicável)
                        if (processamentoComEnrollment.programEnrollment && CONFIG.features.updateStatusAfterEnrollment) {
                            Utils.log('🔄 Atualizando status para 5.Matriculado...');
                            
                            return StatusUpdater.updatePreCad2StatusToMatriculado(frm, processamentoComEnrollment.student.name, processamentoComEnrollment.programEnrollment)
                                .then(function(statusUpdateResult) {
                                    processamentoComEnrollment.statusUpdated = statusUpdateResult;
                                    
                                    // Também atualizar outros registros de PreCad2 relacionados
                                    return StatusUpdater.updateOtherPreCad2Records(processamentoComEnrollment.student.name, processamentoComEnrollment.programEnrollment)
                                        .then(function() {
                                            return processamentoComEnrollment;
                                        });
                                });
                        } else {
                            return processamentoComEnrollment;
                        }
                    })
                    .then(function(finalProcessamento) {
                        // ETAPA 11: Atualizar campos de link
                        return MainProcessor.updateLinksWithPreservation(frm, finalProcessamento);
                    })
                    .then(function(finalProcessamento) {
                        // ETAPA 12: Sucesso final
                        Utils.log('🎯 === CHEGOU NA ETAPA DE SUCESSO ===');
                        frm._creating_documents = false;
                        
                        Utils.log('📋 Resultado final completo:', finalProcessamento);
                        
                        MainProcessor.showSuccessMessages(frm, finalProcessamento);
                        
                        Utils.log('✅ === PROCESSAMENTO CONCLUÍDO COM SUCESSO ===');
                        resolve(finalProcessamento);
                    })
                    .catch(function(error) {
                        Utils.log('❌ Erro capturado no processamento');
                        frm._creating_documents = false;
                        Utils.error('Erro no processamento:', error);
                        
                        MainProcessor.showErrorMessages(frm, error);
                        reject(error);
                    });
                    
                } catch (mainError) {
                    frm._creating_documents = false;
                    Utils.error('Erro no processamento principal:', mainError);
                    MainProcessor.showErrorMessages(frm, mainError);
                    reject(mainError);
                }
            });
        },
        
        updateLinksWithPreservation: function(frm, processamento) {
            Utils.log('🔗 Atualizando campos de link e configurando preservação');
            
            return new Promise(function(resolve) {
                var linksToSave = {};
                if (processamento.customer) linksToSave.customer = processamento.customer.name;
                if (processamento.student)  linksToSave.student = processamento.student.name;
                if (processamento.gestante) linksToSave.gestante = processamento.gestante.name;
                if (processamento.crianca)  linksToSave.crianca = processamento.crianca.name;
                
                Utils.log('📋 Links para salvar:', linksToSave);
                
                var linksParaPreservar = {
                    customer: linksToSave.customer || null,
                    student: linksToSave.student || null,
                    gestante: linksToSave.gestante || null,
                    crianca: linksToSave.crianca || null
                };
                
                if (linksToSave.customer) {
                    frm.set_value('link_cst', linksToSave.customer);
                    frm.doc.link_cst = linksToSave.customer;
                    Utils.log('✅ Campo link_cst atualizado: ' + linksToSave.customer);
                }
                
                if (linksToSave.student) {
                    frm.set_value('link_st', linksToSave.student);
                    frm.doc.link_st = linksToSave.student;
                    Utils.log('✅ Campo link_st atualizado: ' + linksToSave.student);
                }
                
                if (linksToSave.gestante) {
                    frm.set_value('link_ge', linksToSave.gestante);
                    frm.doc.link_ge = linksToSave.gestante;
                    Utils.log('✅ Campo link_ge atualizado: ' + linksToSave.gestante);
                }
                
                if (linksToSave.crianca) {
                    frm.set_value('link_cr', linksToSave.crianca);
                    frm.doc.link_cr = linksToSave.crianca;
                    Utils.log('✅ Campo link_cr atualizado: ' + linksToSave.crianca);
                }
                
                if (!frm._linkPreservationSetup) {
                    Utils.log('🛡️ Configurando preservação de links');
                    frm._preservedLinks = linksParaPreservar;
                    
                    var originalRefresh = frm.refresh;
                    frm.refresh = function() {
                        var result = originalRefresh.call(this);
                        setTimeout(function() {
                            if (frm._preservedLinks) {
                                if (frm._preservedLinks.customer && !frm.doc.link_cst) {
                                    frm.doc.link_cst = frm._preservedLinks.customer;
                                    frm.refresh_field('link_cst');
                                }
                                if (frm._preservedLinks.student && !frm.doc.link_st) {
                                    frm.doc.link_st = frm._preservedLinks.student;
                                    frm.refresh_field('link_st');
                                }
                                if (frm._preservedLinks.gestante && !frm.doc.link_ge) {
                                    frm.doc.link_ge = frm._preservedLinks.gestante;
                                    frm.refresh_field('link_ge');
                                }
                                if (frm._preservedLinks.crianca && !frm.doc.link_cr) {
                                    frm.doc.link_cr = frm._preservedLinks.crianca;
                                    frm.refresh_field('link_cr');
                                }
                            }
                        }, 200);
                        return result;
                    };
                    
                    frm.before_save_callback = function() {
                        if (frm._preservedLinks && !frm._savingInProgress) {
                            if (frm._preservedLinks.customer)   frm.doc.link_cst = frm._preservedLinks.customer;
                            if (frm._preservedLinks.student)    frm.doc.link_st = frm._preservedLinks.student;
                            if (frm._preservedLinks.gestante)   frm.doc.link_ge = frm._preservedLinks.gestante;
                            if (frm._preservedLinks.crianca)    frm.doc.link_cr = frm._preservedLinks.crianca;
                        }
                    };
                    
                    frm.after_save_callback = function() {
                        frm._savingInProgress = false;
                    };
                    
                    frm._linkPreservationSetup = true;
                } else {
                    frm._preservedLinks = linksParaPreservar;
                }
                
                frm.dirty();
                frm.refresh_fields();
                
                setTimeout(function() {
                    if (linksToSave.customer && frm.fields_dict.link_cst) {
                        frm.fields_dict.link_cst.$wrapper.addClass('has-success');
                    }
                    if (linksToSave.student && frm.fields_dict.link_st) {
                        frm.fields_dict.link_st.$wrapper.addClass('has-success');
                    }
                    if (linksToSave.gestante && frm.fields_dict.link_ge) {
                        frm.fields_dict.link_ge.$wrapper.addClass('has-success');
                    }
                    if (linksToSave.crianca && frm.fields_dict.link_cr) {
                        frm.fields_dict.link_cr.$wrapper.addClass('has-success');
                    }
                }, 100);
                
                Utils.log('✅ Links atualizados e preservação configurada');
                resolve(processamento);
            });
        },
        
        showSuccessMessages: function(frm, processamento) {
            Utils.log('🚨 EXECUTANDO MENSAGENS DE SUCESSO');
            
            try {
                frappe.show_alert({ 
                    message: '✅ Cadastro concluído com sucesso!', 
                    indicator: 'green' 
                }, 10);
                Utils.log('✅ Alert 1 executado');
            } catch (alert1Error) {
                Utils.error('Erro no alert 1:', alert1Error);
            }
            
            try {
                var tipoMsg = 'Processamento';
                if (frm.doc.is_ge) tipoMsg = 'Gestantes';
                else if (frm.doc.is_mt) tipoMsg = 'Mundo do Trabalho';
                else if (frm.doc.is_sf) tipoMsg = 'Sócio-Familiar';
                else if (frm.doc.is_cb) tipoMsg = 'Cesta Básica';
                
                frappe.show_alert({ 
                    message: '🎯 ' + tipoMsg + ' processado! Links salvos automaticamente.', 
                    indicator: 'green' 
                }, 8);
                Utils.log('✅ Alert 2 executado para: ' + tipoMsg);
            } catch (alert2Error) {
                Utils.error('Erro no alert 2:', alert2Error);
            }
            
            try {
                Utils.log('🎯 Chamando UI.showSuccess...');
                UI.showSuccess(frm, processamento);
                Utils.log('✅ UI.showSuccess chamado com sucesso');
            } catch (uiError) {
                Utils.error('Erro no UI.showSuccess:', uiError);
                try {
                    frappe.msgprint({
                        title: 'Sucesso',
                        message: '✅ Processamento concluído!<br>Customer: ' + 
                                (processamento.customer ? processamento.customer.name : 'N/A') +
                                '<br>Student: ' + (processamento.student ? processamento.student.name : 'N/A') +
                                '<br>Gestante: ' + (processamento.gestante ? processamento.gestante.name : 'N/A') +
                                '<br>Criança: ' + (processamento.crianca ? processamento.crianca.name : 'N/A') +
                                (processamento.customerUpdated ? '<br>Links salvos no Customer: ✅' : '') +
                                (processamento.statusUpdated ? '<br>Status: 5.Matriculado' : ''),
                        indicator: 'green'
                    });
                    Utils.log('✅ Fallback msgprint executado');
                } catch (msgError) {
                    Utils.error('Erro até no msgprint fallback:', msgError);
                }
            }
        },
        
        showErrorMessages: function(frm, error) {
            Utils.log('❌ Exibindo mensagens de erro');
            
            setTimeout(function() {
                try {
                    UI.showError(frm, error.message || 'Erro desconhecido');
                } catch (uiError) {
                    Utils.error('Erro ao exibir mensagem de erro:', uiError);
                    frappe.show_alert({ 
                        message: '❌ Erro no processamento: ' + (error.message || error), 
                        indicator: 'red' 
                    }, 10);
                }
            }, 200);
        }
    };
    
    // ===== API PÚBLICA =====
    return {
        processar: MainProcessor.process,
        validar: Validator.validateRequired,
        prepararDados: DataPreparator.prepare,
        validarCustomerData: Validator.validateCustomerData,
        atualizarStatusMatriculado: StatusUpdater.updatePreCad2StatusToMatriculado,
        atualizarOutrosRegistros: StatusUpdater.updateOtherPreCad2Records,
        atualizarCustomerComLinks: CustomerUpdater.updateCustomerWithLinks,
        verificarCamposCustomer: CustomerUpdater.checkCustomerFields,
        config: CONFIG,
        version: CONFIG.version,
        isReady: true,
        loadedAt: new Date().toISOString()
    };
    
})();

// ===== AUTO-INICIALIZAÇÃO =====
if (typeof window !== 'undefined') {
    console.log('🚀 === LM PRECAD2 SCRIPT FINAL CARREGADO ===');
    console.log('📦 Versão:', window.LMPreCad2Processor.version);
    console.log('⏰ Carregado em:', window.LMPreCad2Processor.loadedAt);
    console.log('✅ Pronto para uso!');
    console.log('');
    console.log('🆕 NOVAS FUNCIONALIDADES:');
    console.log('→ Criação automática de Criança-Ficha para cadastros is_cb');
    console.log('→ Salvamento automático de link-st, link-ge e link-cr no Customer');
    console.log('→ Atualização automática de status para "5.Matriculado" após Program Enrollment');
    console.log('→ Busca e atualização de outros registros relacionados ao mesmo Student');
    console.log('→ Configuração flexível via CONFIG.features');
    console.log('');
    console.log('🔗 API PÚBLICA DISPONÍVEL:');
    console.log('→ LMPreCad2Processor.processar(frm, dados)');
    console.log('→ LMPreCad2Processor.atualizarCustomerComLinks(customerId, links)');
    console.log('→ LMPreCad2Processor.verificarCamposCustomer(customerId)');
}