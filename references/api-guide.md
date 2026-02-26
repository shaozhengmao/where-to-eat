# 高德地图 MCP API 完整指南

本文档详细说明如何使用高德地图API完成聚餐地点推荐。

## 1. 地理编码 (Geocoding)

### 方法：mcp_tool_amap-maps_maps_geo

**功能**: 将地址字符串转换为坐标

**参数**:
```
address: string (必需) - 地址字符串
city: string (可选) - 城市名称，提高准确性
```

**返回**:
```json
{
  "location": "116.439192,40.027183",  // 经度,纬度
  "formatted_address": "北京市朝阳区来广营",
  "province": "北京市",
  "city": "北京市",
  "district": "朝阳区",
  "adcode": "110105"
}
```

**使用示例**:
```python
# 获取来广营的坐标
result = mcp_tool_amap-maps_maps_geo(
    address="来广营",
    city="北京"
)
# 结果：location="116.439192,40.027183"
```

**最佳实践**:
- 总是提供城市名称以提高准确性
- 如果返回多个结果，选择 level="镇村" 或 "地名" 的结果
- 对模糊地址添加更多上下文（如地标、街道名）

---

## 2. 反向地理编码 (Reverse Geocoding)

### 方法：mcp_tool_amap-maps_maps_regeocode

**功能**: 将坐标转换为地址和地点名称

**参数**:
```
location: string (必需) - 坐标字符串，格式 "经度,纬度"
```

**返回**:
```json
{
  "formatted_address": "北京市朝阳区呼家楼",
  "business": "呼家楼商圈、国贸CBD",
  "province": "北京市",
  "city": "朝阳区",
  "district": "朝阳区"
}
```

**使用示例**:
```python
# 获取中心点的地址
center_coords = "116.371135,40.064888"
result = mcp_tool_amap-maps_maps_regeocode(
    location=center_coords
)
# 结果：formatted_address="北京市朝阳区呼家楼"
```

---

## 3. 驾车路线规划

### 方法：mcp_tool_amap-maps_maps_direction_driving

**功能**: 计算两点间的驾车时间和路线

**参数**:
```
origin: string (必需) - 起点坐标 "经度,纬度"
destination: string (必需) - 终点坐标 "经度,纬度"
```

**返回**:
```json
{
  "route": {
    "paths": [
      {
        "distance": "11356",      // 距离（米）
        "duration": "1169",       // 时间（秒）
        "steps": [...]            // 详细路线步骤
      }
    ]
  }
}
```

**使用示例**:
```python
result = mcp_tool_amap-maps_maps_direction_driving(
    origin="116.439192,40.027183",      # 来广营
    destination="116.371135,40.064888"  # 中心点
)

# 提取信息
distance_m = int(result["route"]["paths"][0]["distance"])
duration_s = int(result["route"]["paths"][0]["duration"])
duration_min = duration_s / 60

print(f"距离: {distance_m/1000:.1f}km, 时间: {duration_min:.0f}分钟")
# 输出: 距离: 11.4km, 时间: 19分钟
```

**解析时间**:
- duration 单位是秒，需要除以60转换为分钟
- 实际出行时间 = API返回时间 + 停车时间(5min) + 等待时间

---

## 4. 公交/地铁路线规划

### 方法：mcp_tool_amap-maps_maps_direction_transit_integrated

**功能**: 计算两点间的公交/地铁时间和换乘信息

**参数**:
```
origin: string (必需) - 起点坐标
destination: string (必需) - 终点坐标
city: string (必需) - 出发地城市名
cityd: string (必需) - 目的地城市名
```

**返回**:
```json
{
  "route": {
    "distance": "1652",          // 总距离（米）
    "transits": [
      {
        "duration": "1958",      // 总用时（秒）
        "walking_distance": "896",
        "segments": [
          {
            "walking": {...},    // 步行段
            "bus": {...}         // 公交段
          }
        ]
      }
    ]
  }
}
```

**使用示例（基础）**:
```python
result = mcp_tool_amap-maps_maps_direction_transit_integrated(
    origin="116.439192,40.027183",
    destination="116.371135,40.064888",
    city="北京",
    cityd="北京"
)

# 提取总时间
duration_s = int(result["route"]["transits"][0]["duration"])
duration_min = duration_s / 60

print(f"总出行时间: {duration_min:.0f}分钟")
# 输出: 总出行时间: 73分钟
```

**⚠️ 关键改进：详细解析各段时间**

API返回的时间包含多个部分，必须区分：

```python
# 详细解析API响应
transit = result["route"]["transits"][0]  # 选择最短路线

# 总时间
total_duration = int(transit["duration"]) / 60  # 分钟

# 解析各段
walking_time = 0
transit_time = 0
transfer_count = 0

for segment in transit["segments"]:
    # 步行时间
    if "walking" in segment:
        walking_time += int(segment["walking"]["duration"]) / 60
    
    # 地铁/公交运行时间
    if "railway" in segment:
        transit_time += int(segment["railway"]["duration"]) / 60
        transfer_count += 1
    elif "bus" in segment:
        transit_time += int(segment["bus"]["duration"]) / 60
        transfer_count += 1

# 换乘时间估算（每次换乘3-5分钟）
transfer_time = transfer_count * 4  # 平均4分钟

# 输出结果
print(f"总出行时间: {total_duration:.0f}分钟")
print(f"  纯地铁/公交运行时间: {transit_time:.0f}分钟")
print(f"  步行时间: {walking_time:.0f}分钟")
print(f"  换乘时间: {transfer_time:.0f}分钟（{transfer_count}次换乘）")
```

**输出格式示例**：
```
地铁出行时间：
  纯地铁运行时间：30分钟（站到站）
  总出行时间：45分钟（含步行15分钟）
  详细路线：
    8号线：朱辛庄站 → 霍营站（2站，5-7分钟）
    换乘13号线（站内换乘，3-5分钟）
    13号线：霍营站 → 立水桥站（5站，15-18分钟）
    换乘5号线（站内换乘，3-5分钟）
    5号线：立水桥站 → 北苑路北站（2站，8-10分钟）
```

**数据验证**：
```python
# 合理性检查
if transit_time > 60 and distance_km < 20:
    print("⚠️ 警告：地铁运行时间可能不合理")
    print("   建议：询问用户是否知道更快的路线")
    # 对比多条路线，选择最优
```

---

## 5. 关键词搜索（餐厅搜索）

### 方法：mcp_tool_amap-maps_maps_text_search

**功能**: 按关键词搜索附近的餐厅

**参数**:
```
keywords: string (必需) - 搜索关键词（如"烤肉"）
city: string (必需) - 城市名称
types: string (可选) - POI类型（如"餐饮"）
```

**返回**:
```json
{
  "pois": [
    {
      "id": "B000AA163A",
      "name": "胡大饭馆(簋街三店)",
      "address": "东直门内大街284号",
      "typecode": "050100",
      "photos": {
        "url": "http://..."
      }
    },
    ...
  ]
}
```

**使用示例**:
```python
result = mcp_tool_amap-maps_maps_text_search(
    keywords="烤肉",
    city="北京"
)

# 提取POI ID列表
poi_ids = [poi["id"] for poi in result["pois"][:10]]
# 结果: ["B000AA163A", "B000AA165J", ...]
```

**搜索关键词标准化**:
```
用户输入        → 搜索关键词
"烤肉"          → "烤肉"
"日料"          → "日本料理"
"海底捞"        → "海底捞火锅"（精确名称）
"米其林"        → "米其林餐厅"
"老字号"        → "老字号美食"
```

---

## 6. 餐厅详情查询

### 方法：mcp_tool_amap-maps_maps_search_detail

**功能**: 获取单家餐厅的完整信息

**参数**:
```
id: string (必需) - POI ID
```

**返回**:
```json
{
  "id": "B000AA163A",
  "name": "胡大饭馆(簋街三店)",
  "location": "116.417601,39.940822",
  "address": "东直门内大街284号",
  "city": "北京市",
  "cost": "137.00",                    // 人均消费
  "opentime2": "周一至周四 11:00-01:00；周五至周六 11:00-02:00",
  "rating": "4.9",                     // 评分
  "open_time": "11:00-01:00"
}
```

**使用示例**:
```python
result = mcp_tool_amap-maps_maps_search_detail(
    id="B000AA163A"
)

# 提取关键信息
restaurant = {
    "name": result["name"],
    "address": result["address"],
    "rating": float(result["rating"]),
    "avg_price": float(result["cost"]),
    "hours": result["open_time"]
}
```

**注意事项**:
- rating 是字符串格式，需要转换为浮点数
- cost 是人均消费，单位为元
- 如果某些字段不存在，使用 .get() 避免KeyError

---

## 7. 骑行路线规划

### 方法：mcp_tool_amap-maps_maps_bicycling

**功能**: 计算两点间的骑行路线和时间

**参数**:
```
origin: string (必需) - 起点坐标 "经度,纬度"
destination: string (必需) - 终点坐标 "经度,纬度"
```

**返回**:
```json
{
  "route": {
    "distance": "2561",      // 距离（米）
    "duration": "1200"       // 时间（秒）
  }
}
```

**使用示例**:
```python
result = mcp_tool_amap-maps_maps_bicycling(
    origin="116.439192,40.027183",      # 来广营
    destination="116.371135,40.064888"  # 中心点
)

# 提取信息
distance_m = int(result["route"]["distance"])
duration_s = int(result["route"]["duration"])
duration_min = duration_s / 60

print(f"骑行距离: {distance_m/1000:.1f}km, 时间: {duration_min:.0f}分钟")
# 输出: 骑行距离: 2.6km, 时间: 20分钟
```

**使用场景**:
- 仅当起点到终点距离 ≤ 3km 时调用
- 作为短距离的替代方案展示给用户

---

## 8. 距离测量

### 方法：mcp_tool_amap-maps_maps_distance

**功能**: 计算两点之间的距离（直线或驾车）

**参数**:
```
origins: string - 起点坐标，可多个（用竖线分隔）
destination: string - 终点坐标
type: string - 0(直线) 1(驾车) 3(步行)
```

**使用示例**:
```python
result = mcp_tool_amap-maps_maps_distance(
    origins="116.439192,40.027183|116.368207,40.076214",
    destination="116.371135,40.064888",
    type="1"  # 驾车距离
)
```

**用途**:
- 快速过滤距离>3km的餐厅
- 在详情查询前进行初步筛选
- 减少不必要的API调用

---

## 常见错误处理（改进版）

### 错误: 地址不存在

**场景**: 用户输入"西边那个商业街"这样的模糊地址

**处理**:
```python
if len(result) == 0:
    # 地址不存在
    return "地址太模糊，无法定位。请提供更详细的地址或地点名称。"

if len(result) > 1:
    # 多个结果，选择最合适的
    # 优先选择: level="镇村" 或 "地名"
    pass
```

### 错误: 出行时间异常（新增）

**场景**: API返回的地铁运行时间明显不合理（如60分钟但距离很近）

**处理**:
```python
# 合理性检查
if transit_time > 60 and distance_km < 20:
    print("⚠️ 警告：地铁运行时间可能不合理")
    print(f"   距离: {distance_km}km，但运行时间: {transit_time}分钟")
    
    # 主动询问用户
    user_route = ask_user("您知道从XX到XX更快的路线吗？")
    
    if user_route:
        # 验证用户提供的路线
        verify_user_route(user_route)
    
    # 对比多条路线
    compare_all_routes(result["route"]["transits"])
```

### 错误: 用户纠正路线（新增）

**场景**: 用户指出路线不正确，提供了正确的路线

**处理**:
```python
# 接受用户纠正
if user_correction:
    print("✓ 感谢您的纠正！")
    update_route_calculation(user_correction)
    
    # 记录用户知识，用于后续参考
    save_user_knowledge(origin, destination, user_correction)
    
    # 重新计算
    recalculate_travel_time()
```

### 错误: API调用频率限制

**现象**: `"CUQPS_HAS_EXCEEDED_THE_LIMIT"`

**解决**:
- 添加延迟（sleep 0.5-1秒）
- 缓存已查询过的地址
- 合并多个API调用

### 错误: 无法规划路线

**现象**: 起点和终点无法连接（可能在不同城市）

**处理**:
```python
try:
    result = mcp_tool_amap-maps_maps_direction_driving(...)
except Exception as e:
    # 使用反向编码检查坐标是否有效
    # 或切换到公交路线
    pass
```

---

## 性能优化建议

### 1. 批量查询地理编码

```python
# ❌ 低效：逐个查询
for address in addresses:
    result = mcp_tool_amap-maps_maps_geo(address)

# ✅ 高效：提前收集所有地址，批量处理
results = [mcp_tool_amap-maps_maps_geo(addr) for addr in addresses]
```

### 2. 缓存常用结果

```python
# 缓存已查询过的地址坐标
geocode_cache = {}

def get_coords(address):
    if address in geocode_cache:
        return geocode_cache[address]
    result = mcp_tool_amap-maps_maps_geo(address)
    geocode_cache[address] = result
    return result
```

### 3. 并行调用（如支持）

```python
# 计算3个人到中心点的时间 - 可并行执行
# 使用高效的API调用顺序
```

---

## 数据提取模板

### 参与者出行时间表

```python
def extract_travel_times(participants, center_coords):
    """
    参与者: [{"name": "张三", "location": "来广营"}, ...]
    中心坐标: "116.371135,40.064888"

    返回: 所有人的出行时间表
    """

    result_table = []

    for p in participants:
        # 获取起点坐标
        origin = mcp_tool_amap-maps_maps_geo(
            address=p["location"],
            city="北京"
        )["location"]

        # 计算驾车时间
        driving = mcp_tool_amap-maps_maps_direction_driving(
            origin=origin,
            destination=center_coords
        )
        drive_min = int(driving["route"]["paths"][0]["duration"]) / 60

        # 计算公交时间
        transit = mcp_tool_amap-maps_maps_direction_transit_integrated(
            origin=origin,
            destination=center_coords,
            city="北京",
            cityd="北京"
        )
        transit_min = int(transit["route"]["transits"][0]["duration"]) / 60

        result_table.append({
            "name": p["name"],
            "location": p["location"],
            "driving_min": drive_min,
            "transit_min": transit_min
        })

    return result_table
```

### 餐厅推荐列表生成

```python
def get_restaurant_recommendations(keywords, city, top_n=5):
    """
    根据关键词搜索餐厅并排序
    """

    # Step 1: 搜索餐厅
    search_result = mcp_tool_amap-maps_maps_text_search(
        keywords=keywords,
        city=city
    )

    # Step 2: 获取详细信息
    restaurants = []
    for poi in search_result["pois"][:10]:
        detail = mcp_tool_amap-maps_maps_search_detail(id=poi["id"])

        restaurants.append({
            "id": detail["id"],
            "name": detail["name"],
            "address": detail["address"],
            "rating": float(detail["rating"]),
            "avg_price": float(detail["cost"]),
            "hours": detail["open_time"]
        })

    # Step 3: 按评分排序
    restaurants.sort(key=lambda x: x["rating"], reverse=True)

    return restaurants[:top_n]
```

---

## 完整工作流代码框架

```python
def find_best_restaurant(participants, food_pref, city="北京"):
    """
    完整的聚餐推荐流程
    """

    # 1. 地理编码
    coords = []
    for p in participants:
        result = mcp_tool_amap-maps_maps_geo(address=p, city=city)
        coords.append(result["location"])

    # 2. 计算中心点
    lats = [float(c.split(",")[1]) for c in coords]
    lons = [float(c.split(",")[0]) for c in coords]
    center_lat = sum(lats) / len(lats)
    center_lon = sum(lons) / len(lons)
    center_coords = f"{center_lon},{center_lat}"

    # 3. 反向编码获取地点名称
    center_info = mcp_tool_amap-maps_maps_regeocode(center_coords)

    # 4. 计算出行时间（见上面的 extract_travel_times）
    travel_times = extract_travel_times(
        [{"name": f"Person{i}", "location": p} for i, p in enumerate(participants)],
        center_coords
    )

    # 5. 搜索和推荐餐厅（见上面的 get_restaurant_recommendations）
    restaurants = get_restaurant_recommendations(food_pref, city)

    # 6. 返回完整推荐
    return {
        "center_location": center_info,
        "travel_times": travel_times,
        "restaurants": restaurants
    }

