SELECT
   INSTANCIA = <<INSTANCIA>>
  ,PKCARGO = CONVERT(VARCHAR, CODCOLIGADA) + '_' + CODIGO
  ,[Codigo do Cargo] = CODIGO
  ,[Nome do Cargo] = NOME
  ,[Data de Alteracao RECNO] = CONVERT(VARCHAR(10), RECMODIFIEDON, 112)
FROM
  PCARGO WITH (NOLOCK)

UNION ALL

SELECT
   INSTANCIA = <<INSTANCIA>>
  ,PKCARGO = CONVERT(VARCHAR, CODCOLIGADA) + '_N/A'
  ,[Codigo do Cargo] = 'N/A'
  ,[Nome do Cargo] = 'N/A'
  ,[Data de Alteracao RECNO] = null
FROM
  GCOLIGADA WITH (NOLOCK)
;