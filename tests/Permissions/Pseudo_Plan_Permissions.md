#Psuedo Plan Permissions

### *Record base 98452583*

# ***Summary***

This page is the Permisos (Leave Management) module of ADA’s Nómina (Payroll) system. It is used to record, view, and manage employee leaves of absence and special work permissions.

Key Features
Employee Search: Look up employees using their ID number (CC/NIT).

Permission History: View registered leaves and permissions for a selected employee.

Leave Data Entry: Set start/end dates, add descriptions, mark approval statuses, specify administrative acts, and toggle compensatory settings.

Action Controls: Create new records, save updates, or delete existing permission entries.


| field | bound | ErrorMsg |
| --- | --- | --- |
| CCNIT | max 18 | Error For input string: "9845258312139342000" |
| Acto administrativo | max 19 | Error Numeric value ({input value}) out of range |
| Descripción | max 200 | scDescripcion debe tener máximo 200 caracteres |

## Logic flow

### Listado de permisos
The app allow select an employ for an specific CC existing on module 'Empleados', to do this you need put the correct cc
and later click on 'Buscar CC/NIT' to pick up values on 'Listado de Permisos' or if you want to add another permisson
on 'Datos del Permiso' form. Next to 'Buscar CC/NIT' you can click on 'Seleccionar' for open a side panel called 'Seleccionar
Empleado', so once you're there can look at in a list from a request copy of the 'Empleados module' list that we were talking
a few moments and pick up either record. For 'Seleccionar Empleado' there are 2 inputs named: 'Consultar' & 'Tipo de tercero',
for this automation suite we only cover 'Consultar' neither 'Tipo de tercero'.

### Listado de permisos

Once you have a selected CC, you can look at the current permissions, like an historic table with four columns
|Aprobada	|Empleado|	Desde	|Hasta	|Descripción
for that record.

### Datos del permiso
Here is the main flow, we can there assign dates with the fields Desde|Hasta, this is connected with other modules so 
if an employee has vacations, Incapacidades, Licencias, Licencias por calamidad, etc inside the desired range it notifies
with a correct error modal and avoid to save changes.

There's Descripción camp like text-area. These checkbox areas has a relation on its behavior so checking for 'Compensatorio'
it changes 'Permiso', the relation is the next:

Compensatorio = SI => Permiso = NO

Compensatorio = NO => Permiso = NO

Compensatorio = NO => Permiso = SI

Although there isn't a '*' for 'Acto administrativo' is a obligatory field and you can put there a repeat or either number there.

For Fecha acto administrativo you cannot select a date grater than 'Desde*', only the equal or less.
The error message is 'Error
La Fecha Acto debe ser menor o igual a la Fecha Desde.'

Ok, until now we don't have touched the main main checkbox area: 'APROBADA *' why? this allow to allow a permission on the
'Lista de Permisos' to be editable or only read mode, so if it's approved it is blocked and no  allow future
modifications, as well the delete record is disabled. 

Finally, ignore IBC permiso$.
## NavBar buttons
There are 3 buttons, Nuevo, Guardar and Eliminar (deletes from 'Lista de Permisos' but if the record is approved it's
not allow to delete it, so Guardar and Eliminar are disabled).

## Requests

### Empleado
- https://nomina-qa-api.adacsc.co/api/v1/w-vacaciones-licencias-ascensos-permisos/empleados/by-nitsd/98452583

- - This one allows a brief description.

### Listado del Permiso
- https://nomina-qa-api.adacsc.co/api/v1/w-vacaciones-licencias-ascensos-permisos/rows?kaNlTercero=10236&limit=200&calamidad=N
- - This one brings a list of all rows
### Datos del Permiso
- https://nomina-qa-api.adacsc.co/api/v1/w-vacaciones-licencias-ascensos-permisos/rows/432
- - This one is for all information for the main form.

### When Guardar button is clicked
- https://nomina-qa-api.adacsc.co/api/v1/errores-reporte/actions/grabar
-- Saves the record

### When Seleccionar button is clicked
- https://nomina-qa-api.adacsc.co/api/v1/w-vacaciones-licencias-ascensos-permisos/lookups/empleados?limit=2000&query=
-- This one is for the side panel 'Seleccionar Empleado' and brings a list of all employees.
- https://nomina-qa-api.adacsc.co/api/v1/w-vacaciones-licencias-ascensos-permisos/empleados/11290
-- When you select one employee is just a request from kanlTercero.

### When you click on 'Eliminar' button
Request URL
https://nomina-qa-api.adacsc.co/api/v1/w-vacaciones-licencias-ascensos-permisos/rows/441
Request method
DELETE



## Obligatory fields
All fields less 'Fecha acto administrativo'


## Error messages and additional information

# *Acto administrativo*
The 'Acto administrativo' field is required and it could be either value or a repeated one, his absence
will trigger 'Error
Debe ingresar el Acto Administrativo.'

# *Repeated date or  relationed date with other modules -- Collision problems*
When the date is repeated the endpoint rows will trigger 'Error
El empleado se encuentra en un permiso y/o compensatorio ya registrado en el rango indicado.'

For vacations it'll trigger 'Error
Existe un registro de vacaciones que se cruza con las fechas registradas.'

For incapacidades it'll trigger 'Error
El empleado se encuentra en una incapacidad en el rango indicado.'

For absence it'll trigger 'Error
El empleado se encuentra en una ausencia/suspensión en el rango indicado.'

For licence it'll trigger 'Error
El empleado se encuentra en una licencia en el rango indicado.'

For calamity licence it'll trigger 'Error
El empleado se encuentra en licencia de calamidad en el rango indicado.'

# *CC empty or invalid*
When the CC is over bundle it will trigger Error
For input string: "9845258312139342000"

When the cc is inside the bundle and is not found 'Error
Empleado no encontrado para nit=984525831213934200'

# *Seleccionar*
When there's no records found on 'Consultar' input
Sin resultados

No se encontraron empleados para la consulta actual.

# *Listado de Permisos*
The msg when there's no records is 'Sin permisos

Busque o seleccione un empleado para consultar sus permisos.'

# *Datos del Permiso*
When the 'Desde' field is empty it will trigger
Error
Debe ingresar la Fecha Desde.

When the 'Hasta' field is empty it will trigger
Error
Debe ingresar la Fecha Hasta.

When description field is empty it will trigger
Error
Debe ingresar la Descripcion.

When Fecha acto administrativo is greater than Desde it will trigger
Error
La Fecha Acto debe ser menor o igual a la Fecha Desde.
